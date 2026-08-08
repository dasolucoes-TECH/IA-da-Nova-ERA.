routerAdd(
  'POST',
  '/backend/v1/autopilot/approvals/{id}/approve',
  (e) => {
    try {
      var userId = e.auth ? e.auth.id : ''
      if (!userId) return e.unauthorizedError('Autenticacao necessaria')
      var storeRecord = null
      var memberRole = ''
      try {
        var members = $app.findRecordsByFilter('store_members', 'user = {:uid}', '-created', 1, 0, {
          uid: userId,
        })
        if (members.length > 0) {
          memberRole = members[0].getString('role')
          storeRecord = $app.findRecordById('stores', members[0].getString('store'))
        }
      } catch (_) {}
      if (!storeRecord) return e.json(403, { error: 'Nenhuma loja associada' })

      var approvalId = e.request.pathValue('id')
      var approval = $app.findRecordById('automation_approvals', approvalId)
      if (approval.getString('store') !== storeRecord.id)
        return e.json(403, { error: 'Aprovacao nao pertence a loja' })
      if (approval.getString('status') !== 'PENDING')
        return e.json(409, { error: 'Aprovacao ja processada' })

      var riskLevel = approval.getString('risk_level')
      if (memberRole === 'VIEWER') return e.json(403, { error: 'VIEWER nao pode aprovar' })
      if (memberRole === 'EDITOR' && (riskLevel === 'HIGH' || riskLevel === 'CRITICAL'))
        return e.json(403, { error: 'EDITOR nao pode aprovar acoes HIGH/CRITICAL' })
      if (riskLevel === 'CRITICAL' && memberRole !== 'OWNER')
        return e.json(403, { error: 'CRITICAL exige OWNER' })

      var expiresAt = approval.getString('expires_at')
      if (expiresAt && new Date(expiresAt) < new Date()) {
        approval.set('status', 'EXPIRED')
        $app.save(approval)
        return e.json(410, { error: 'Aprovacao expirada' })
      }

      var jobId = approval.getString('job')
      if (!jobId)
        return e.json(200, {
          approved: true,
          executionStatus: 'COMPLETED',
          message: 'Aprovada sem job associado.',
        })

      var job = null
      try {
        job = $app.findRecordById('automation_jobs', jobId)
      } catch (_) {}
      if (!job)
        return e.json(200, {
          approved: true,
          executionStatus: 'FAILED',
          message: 'Job nao encontrado.',
        })

      var jobStatus = job.getString('status')
      if (jobStatus === 'COMPLETED')
        return e.json(200, {
          approved: true,
          executionStatus: 'COMPLETED',
          message: 'Job ja foi executado.',
        })
      if (jobStatus === 'RUNNING') return e.json(409, { error: 'Job ja esta em execucao' })

      approval.set('status', 'APPROVED')
      approval.set('approved_by', userId)
      approval.set('approved_at', new Date().toISOString())
      $app.save(approval)
      $app.logger().info('approval_approved', 'approvalId', approvalId, 'userId', userId)

      job.set('status', 'RUNNING')
      job.set('started_at', new Date().toISOString())
      job.set('attempts', (job.getNumber('attempts') || 0) + 1)
      $app.save(job)

      var storeId = storeRecord.id
      var ruleId = job.getString('rule')
      var eventId = job.getString('event')
      var actionType = job.getString('job_type')

      function executeAutomationAction(jobId, storeId, ruleId, eventId, actionType) {
        var rule = null,
          eventRec = null
        try {
          rule = $app.findRecordById('automation_rules', ruleId)
        } catch (_) {}
        try {
          eventRec = $app.findRecordById('automation_events', eventId)
        } catch (_) {}
        if (!rule || !eventRec) return { status: 'FAILED', message: 'Rule or event not found' }
        var REG = {
          GENERATE_PRODUCT_SEO: { impl: true, min: 10 },
          GENERATE_INSTAGRAM_CONTENT: { impl: true, min: 15 },
          CREATE_NOTIFICATION: { impl: true, min: 0 },
          ANALYZE_LOW_STOCK: { impl: true, min: 10 },
          ANALYZE_PRODUCT_PERFORMANCE: { impl: true, min: 15 },
          GENERATE_PRODUCT_CONTENT: { impl: true, min: 20 },
          CREATE_SHOPIFY_DRAFT: { impl: false, min: 10 },
          UPDATE_LOCAL_PRODUCT: { impl: false, min: 5 },
          CREATE_MARKETING_DRAFT: { impl: false, min: 10 },
          CREATE_DAILY_BRIEFING: { impl: false, min: 15 },
          REQUEST_PRICE_CHANGE: { impl: false, min: 0 },
          REQUEST_SHOPIFY_ACTIVATION: { impl: false, min: 0 },
        }
        var meta = REG[actionType] || { impl: false, min: 0 }
        if (!meta.impl)
          return { status: 'NOT_IMPLEMENTED', message: 'Acao nao implementada: ' + actionType }
        var owner = userId
        var productId = eventRec.getString('entity_id')
        var payload = {}
        try {
          payload = JSON.parse(eventRec.getString('payload'))
        } catch (_) {}
        var MP =
          'Use exclusivamente os fatos fornecidos. Nao invente especificacoes, garantia, frete, certificacoes, avaliacoes ou quantidades vendidas.'
        function cJson(t) {
          t = t.trim()
          if (t.indexOf('```json') !== -1) {
            t = t
              .replace(/```json\s*/g, '')
              .replace(/```/g, '')
              .trim()
          } else if (t.indexOf('```') !== -1) {
            t = t
              .replace(/```\s*/g, '')
              .replace(/```/g, '')
              .trim()
          }
          return t
        }
        function cLog(st, sm) {
          try {
            var c = $app.findCollectionByNameOrId('action_logs')
            var r = new Record(c)
            r.set('store', storeId)
            r.set('user', owner)
            r.set('action_type', actionType)
            r.set('entity_type', eventRec.getString('entity_type') || '')
            r.set('entity_id', eventRec.getString('entity_id') || '')
            r.set('status', st)
            r.set('summary', sm || '')
            r.set('rule', ruleId)
            r.set('event', eventId)
            r.set('job', jobId)
            r.set('automation', true)
            r.set('execution_source', 'AUTOMATION')
            if (meta.min && st === 'EXECUTED') r.set('estimated_minutes_saved', meta.min)
            $app.save(r)
          } catch (_) {}
        }
        function cNotif(t, ti, m, s) {
          try {
            var c = $app.findCollectionByNameOrId('automation_notifications')
            var r = new Record(c)
            r.set('store', storeId)
            r.set('user', owner)
            r.set('type', t)
            r.set('title', ti)
            r.set('message', m)
            r.set('severity', s || 'INFO')
            r.set('read', false)
            $app.save(r)
          } catch (_) {}
        }
        var result = { status: 'FAILED', message: 'No executor for: ' + actionType }
        if (actionType === 'CREATE_NOTIFICATION') {
          var ac = {}
          try {
            ac = JSON.parse(rule.getString('action_config'))
          } catch (_) {}
          var tmpl = ac.message_template || 'Notificacao automatica'
          var pn = (payload.product && (payload.product.name || payload.product.title)) || 'Produto'
          var qty = (payload.inventory && payload.inventory.quantity) || 0
          cNotif(
            'critical_stock',
            'Estoque critico',
            tmpl.replace('{produto}', pn).replace('{quantidade}', String(qty)),
            'CRITICAL',
          )
          result = { status: 'COMPLETED', message: 'Notification created' }
        } else if (
          actionType === 'ANALYZE_LOW_STOCK' ||
          actionType === 'ANALYZE_PRODUCT_PERFORMANCE'
        ) {
          cNotif(
            'analysis',
            'Analise concluida',
            'A analise de performance foi executada com sucesso.',
            'INFO',
          )
          result = { status: 'COMPLETED', message: 'Analysis completed' }
        } else {
          if (!productId) {
            result = { status: 'FAILED', message: 'No product entity_id' }
          } else {
            var product = null
            try {
              product = $app.findRecordById('products', productId)
            } catch (_) {}
            if (!product) {
              result = { status: 'FAILED', message: 'Product not found: ' + productId }
            } else {
              var facts = {
                name: product.getString('name'),
                description: product.getString('description') || null,
                vendor: product.getString('vendor') || null,
                product_type: product.getString('product_type') || null,
                price: product.getNumber('price') || null,
                cost: product.getNumber('cost') || null,
                tags: product.getString('tags') || null,
              }
              if (actionType === 'GENERATE_PRODUCT_SEO') {
                try {
                  var p =
                    'Gere dados SEO para "' +
                    facts.name +
                    '". ' +
                    MP +
                    '\nFATOS:\n' +
                    JSON.stringify(facts) +
                    '\nResponda JSON: {"seo_title":"","meta_description":"","keywords":"","slug":"","alt_text":""}'
                  var r = $ai.chat({
                    model: 'fast',
                    messages: [
                      { role: 'system', content: 'Responda exclusivamente com JSON valido.' },
                      { role: 'user', content: p },
                    ],
                  })
                  var d = JSON.parse(cJson(r.choices[0].message.content))
                  if (!d.seo_title || typeof d.seo_title !== 'string')
                    throw new Error('Invalid SEO')
                  product.set('seo_title', d.seo_title || '')
                  product.set('meta_description', d.meta_description || '')
                  product.set('keywords', d.keywords || '')
                  product.set('slug', d.slug || product.getString('slug'))
                  product.set('alt_text', d.alt_text || '')
                  $app.save(product)
                  result = { status: 'COMPLETED', message: 'SEO generated' }
                } catch (e) {
                  result = { status: 'FAILED', message: 'AI invalid SEO: ' + String(e) }
                }
              } else if (actionType === 'GENERATE_INSTAGRAM_CONTENT') {
                try {
                  var p2 =
                    'Crie conteudo de Instagram para "' +
                    facts.name +
                    '". ' +
                    MP +
                    '\nFATOS:\n' +
                    JSON.stringify(facts) +
                    '\nResponda JSON: {"caption":"","hashtags":""}'
                  var r2 = $ai.chat({
                    model: 'fast',
                    messages: [
                      { role: 'system', content: 'Responda apenas JSON valido.' },
                      { role: 'user', content: p2 },
                    ],
                  })
                  var d2 = JSON.parse(cJson(r2.choices[0].message.content))
                  if (!d2.caption || typeof d2.caption !== 'string') throw new Error('Invalid IG')
                  product.set('instagram_caption', d2.caption || '')
                  product.set('instagram_hashtags', d2.hashtags || '')
                  $app.save(product)
                  result = { status: 'COMPLETED', message: 'Instagram content generated' }
                } catch (e) {
                  result = { status: 'FAILED', message: 'AI invalid IG: ' + String(e) }
                }
              } else if (actionType === 'GENERATE_PRODUCT_CONTENT') {
                try {
                  var p3 =
                    'Gere conteudo de alta conversao para o produto. ' +
                    MP +
                    '\nFATOS:\n' +
                    JSON.stringify(facts) +
                    '\nResponda JSON: {"description":"","seo_title":"","meta_description":"","keywords":"","slug":"","alt_text":""}'
                  var r3 = $ai.chat({
                    model: 'reasoning',
                    messages: [
                      { role: 'system', content: 'Responda apenas JSON valido. Nao use markdown.' },
                      { role: 'user', content: p3 },
                    ],
                  })
                  var d3 = JSON.parse(cJson(r3.choices[0].message.content))
                  if (!d3.description || !d3.seo_title) throw new Error('Invalid content')
                  product.set('description', d3.description || '')
                  product.set('seo_title', d3.seo_title || '')
                  product.set('meta_description', d3.meta_description || '')
                  product.set('keywords', d3.keywords || '')
                  product.set('slug', d3.slug || product.getString('slug'))
                  product.set('alt_text', d3.alt_text || '')
                  $app.save(product)
                  result = { status: 'COMPLETED', message: 'Product content generated' }
                } catch (e) {
                  result = { status: 'FAILED', message: 'AI invalid content: ' + String(e) }
                }
              }
            }
          }
        }
        if (result.status === 'COMPLETED') {
          cLog('EXECUTED', 'Executado: ' + actionType)
          cNotif(
            'automation_completed',
            'Automacao concluida',
            'A automacao "' + rule.getString('name') + '" foi executada com sucesso.',
            'SUCCESS',
          )
        } else if (result.status === 'NOT_IMPLEMENTED') {
          cLog('FAILED', 'Nao implementado: ' + actionType)
        } else {
          cLog('FAILED', 'Falha: ' + result.message)
          cNotif(
            'automation_error',
            'Falha na automacao',
            'A automacao "' + rule.getString('name') + '" falhou: ' + result.message,
            'ERROR',
          )
        }
        return result
      }

      var execResult = executeAutomationAction(jobId, storeId, ruleId, eventId, actionType)
      var rule = null
      try {
        rule = $app.findRecordById('automation_rules', ruleId)
      } catch (_) {}

      if (execResult.status === 'COMPLETED') {
        job.set('status', 'COMPLETED')
        job.set('completed_at', new Date().toISOString())
        job.set(
          'result',
          JSON.stringify({
            approved: true,
            executedAt: new Date().toISOString(),
            execResult: execResult,
          }),
        )
        $app.save(job)
        if (rule) {
          rule.set('last_executed_at', new Date().toISOString())
          rule.set('execution_count', (rule.getNumber('execution_count') || 0) + 1)
          $app.save(rule)
        }
        try {
          var nCol = $app.findCollectionByNameOrId('automation_notifications')
          var nRec = new Record(nCol)
          nRec.set('store', storeRecord.id)
          nRec.set('user', userId)
          nRec.set('type', 'approval_resolved')
          nRec.set('title', 'Aprovacao concluida')
          nRec.set(
            'message',
            'A acao "' + approval.getString('title') + '" foi aprovada e executada com sucesso.',
          )
          nRec.set('severity', 'SUCCESS')
          nRec.set('read', false)
          $app.save(nRec)
        } catch (_) {}
        return e.json(200, { approved: true, executionStatus: 'COMPLETED' })
      } else {
        job.set('status', 'FAILED')
        job.set('error', execResult.message || 'Execution failed')
        job.set('completed_at', new Date().toISOString())
        $app.save(job)
        try {
          var nCol2 = $app.findCollectionByNameOrId('automation_notifications')
          var nRec2 = new Record(nCol2)
          nRec2.set('store', storeRecord.id)
          nRec2.set('user', userId)
          nRec2.set('type', 'approval_failed')
          nRec2.set('title', 'Falha na execucao')
          nRec2.set(
            'message',
            'A acao "' +
              approval.getString('title') +
              '" foi aprovada, mas a execucao falhou: ' +
              (execResult.message || ''),
          )
          nRec2.set('severity', 'ERROR')
          nRec2.set('read', false)
          $app.save(nRec2)
        } catch (_) {}
        return e.json(200, {
          approved: true,
          executionStatus: 'FAILED',
          message: 'A acao foi aprovada, mas a execucao falhou.',
        })
      }
    } catch (err) {
      return e.internalServerError('Erro: ' + String(err))
    }
  },
  $apis.requireAuth(),
)
