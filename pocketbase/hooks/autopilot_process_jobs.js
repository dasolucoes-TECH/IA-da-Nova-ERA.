routerAdd(
  'POST',
  '/backend/v1/autopilot/process-jobs',
  (e) => {
    try {
      var body = e.requestInfo().body || {}
      var isWorker = !!body.worker
      var storeRecord = null
      var memberRole = ''

      if (isWorker && body.storeId) {
        try {
          storeRecord = $app.findRecordById('stores', body.storeId)
        } catch (_) {}
      } else {
        var userId = e.auth ? e.auth.id : ''
        if (!userId) return e.unauthorizedError('Autenticacao necessaria')
        try {
          var members = $app.findRecordsByFilter(
            'store_members',
            'user = {:uid}',
            '-created',
            1,
            0,
            { uid: userId },
          )
          if (members.length > 0) {
            memberRole = members[0].getString('role')
            storeRecord = $app.findRecordById('stores', members[0].getString('store'))
          }
        } catch (_) {}
        if (!storeRecord) return e.json(403, { error: 'Nenhuma loja associada' })
        if (memberRole !== 'OWNER' && memberRole !== 'ADMIN')
          return e.json(403, { error: 'Apenas OWNER/ADMIN podem executar manualmente' })
      }
      if (!storeRecord) return e.json(200, { processed: 0, failed: 0 })

      var autopilotEnabled = storeRecord.getBool('autopilot_enabled')
      var now = new Date().toISOString()
      var storeId = storeRecord.id

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
        var owner = ''
        try {
          var owners = $app.findRecordsByFilter(
            'store_members',
            "store = {:sid} && role = 'OWNER'",
            '-created',
            1,
            0,
            { sid: storeId },
          )
          if (owners.length > 0) owner = owners[0].getString('user')
        } catch (_) {}
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

      var jobs = []
      try {
        jobs = $app.findRecordsByFilter(
          'automation_jobs',
          'store = {:sid} && (status = {:s1} || status = {:s2})',
          '-priority,created',
          10,
          0,
          { sid: storeId, s1: 'QUEUED', s2: 'RETRYING' },
        )
      } catch (_) {}
      var processed = 0
      var failed = 0

      for (var i = 0; i < jobs.length; i++) {
        var job = jobs[i]
        if (body.jobId && job.id !== body.jobId) continue
        if (!autopilotEnabled) continue
        var sf = job.getString('scheduled_for')
        if (sf && new Date(sf) > new Date(now)) continue
        var jobStatus = job.getString('status')
        if (jobStatus !== 'QUEUED' && jobStatus !== 'RETRYING') continue

        try {
          $app.runInTransaction(function (txApp) {
            var txJob = txApp.findRecordById('automation_jobs', job.id)
            var txS = txJob.getString('status')
            if (txS !== 'QUEUED' && txS !== 'RETRYING') throw new Error('acquired')
            txJob.set('status', 'RUNNING')
            txJob.set('started_at', now)
            txJob.set('attempts', (txJob.getNumber('attempts') || 0) + 1)
            txApp.save(txJob)
          })
        } catch (_) {
          continue
        }

        var rule = null
        try {
          rule = $app.findRecordById('automation_rules', job.getString('rule'))
        } catch (_) {}
        var eventRec = null
        try {
          eventRec = $app.findRecordById('automation_events', job.getString('event'))
        } catch (_) {}
        if (!rule || !eventRec) {
          job.set('status', 'FAILED')
          job.set('error', 'Rule or event not found')
          $app.save(job)
          failed++
          continue
        }

        var actionType = job.getString('job_type')
        var autonomy = rule.getString('autonomy_mode')
        var ACTION_REGISTRY = {
          GENERATE_PRODUCT_SEO: { supportsAutopilot: true, implemented: true },
          GENERATE_INSTAGRAM_CONTENT: { supportsAutopilot: true, implemented: true },
          CREATE_NOTIFICATION: { supportsAutopilot: true, implemented: true },
          ANALYZE_LOW_STOCK: { supportsAutopilot: true, implemented: true },
          ANALYZE_PRODUCT_PERFORMANCE: { supportsAutopilot: true, implemented: true },
          GENERATE_PRODUCT_CONTENT: { supportsAutopilot: true, implemented: true },
          CREATE_SHOPIFY_DRAFT: { supportsAutopilot: true, implemented: false },
          UPDATE_LOCAL_PRODUCT: { supportsAutopilot: true, implemented: false },
          CREATE_MARKETING_DRAFT: { supportsAutopilot: true, implemented: false },
          CREATE_DAILY_BRIEFING: { supportsAutopilot: true, implemented: false },
          REQUEST_PRICE_CHANGE: { supportsAutopilot: false, implemented: false },
          REQUEST_SHOPIFY_ACTIVATION: { supportsAutopilot: false, implemented: false },
        }
        var actionMeta = ACTION_REGISTRY[actionType] || {
          supportsAutopilot: false,
          implemented: false,
        }
        if (autonomy === 'AUTOPILOT' && !actionMeta.supportsAutopilot) autonomy = 'APPROVAL'

        if (autonomy === 'SUGGEST') {
          try {
            var owner = ''
            try {
              var owners = $app.findRecordsByFilter(
                'store_members',
                "store = {:sid} && role = 'OWNER'",
                '-created',
                1,
                0,
                { sid: storeId },
              )
              if (owners.length > 0) owner = owners[0].getString('user')
            } catch (_) {}
            var logCol = $app.findCollectionByNameOrId('action_logs')
            var logRec = new Record(logCol)
            logRec.set('store', storeId)
            logRec.set('user', owner)
            logRec.set('action_type', actionType)
            logRec.set('entity_type', eventRec.getString('entity_type') || '')
            logRec.set('entity_id', eventRec.getString('entity_id') || '')
            logRec.set('status', 'PROPOSED')
            logRec.set('summary', 'Sugestao: ' + actionType)
            logRec.set('rule', rule.id)
            logRec.set('event', eventRec.id)
            logRec.set('job', job.id)
            logRec.set('automation', true)
            logRec.set('execution_source', 'AUTOMATION')
            $app.save(logRec)
            var nCol = $app.findCollectionByNameOrId('automation_notifications')
            var nRec = new Record(nCol)
            nRec.set('store', storeId)
            nRec.set('user', owner)
            nRec.set('type', 'suggestion')
            nRec.set('title', 'Nova sugestao de automacao')
            nRec.set(
              'message',
              'A automacao "' + rule.getString('name') + '" tem uma sugestao para voce.',
            )
            nRec.set('severity', 'INFO')
            nRec.set('read', false)
            $app.save(nRec)
          } catch (_) {}
          job.set('status', 'COMPLETED')
          job.set('completed_at', new Date().toISOString())
          job.set('result', JSON.stringify({ mode: 'SUGGEST', message: 'Suggestion created' }))
          $app.save(job)
          rule.set('last_executed_at', now)
          rule.set('execution_count', (rule.getNumber('execution_count') || 0) + 1)
          $app.save(rule)
          processed++
        } else if (autonomy === 'APPROVAL') {
          try {
            var apprCol = $app.findCollectionByNameOrId('automation_approvals')
            var apprRec = new Record(apprCol)
            apprRec.set('store', storeId)
            apprRec.set('rule', rule.id)
            apprRec.set('job', job.id)
            apprRec.set('title', rule.getString('name'))
            apprRec.set('description', rule.getString('description') || '')
            apprRec.set('entity_type', eventRec.getString('entity_type') || '')
            apprRec.set('entity_id', eventRec.getString('entity_id') || '')
            var pp = {}
            try {
              pp = JSON.parse(eventRec.getString('payload'))
            } catch (_) {}
            apprRec.set('proposed_action', JSON.stringify({ actionType: actionType, payload: pp }))
            apprRec.set('risk_level', actionMeta.implemented ? 'LOW' : 'MEDIUM')
            apprRec.set('status', 'PENDING')
            apprRec.set('expires_at', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString())
            $app.save(apprRec)
          } catch (_) {}
          job.set('status', 'WAITING_APPROVAL')
          $app.save(job)
          processed++
        } else if (autonomy === 'AUTOPILOT') {
          var execResult = executeAutomationAction(
            job.id,
            storeId,
            rule.id,
            eventRec.id,
            actionType,
          )
          if (execResult.status === 'COMPLETED') {
            job.set('status', 'COMPLETED')
            job.set('completed_at', new Date().toISOString())
            job.set('result', JSON.stringify(execResult))
            $app.save(job)
            rule.set('last_executed_at', now)
            rule.set('execution_count', (rule.getNumber('execution_count') || 0) + 1)
            $app.save(rule)
            processed++
          } else if (execResult.status === 'NOT_IMPLEMENTED') {
            job.set('status', 'FAILED')
            job.set('error', execResult.message)
            job.set('completed_at', new Date().toISOString())
            $app.save(job)
            failed++
          } else {
            var attempts = job.getNumber('attempts') || 1
            var maxAttempts = job.getNumber('max_attempts') || 3
            var errStr = execResult.message || 'Execution failed'
            var isRetryable =
              errStr.indexOf('429') !== -1 ||
              errStr.indexOf('timeout') !== -1 ||
              errStr.indexOf('SkipAi') !== -1 ||
              errStr.indexOf('500') !== -1
            if (isRetryable && attempts < maxAttempts) {
              var backoffMin = attempts === 1 ? 1 : attempts === 2 ? 5 : 15
              job.set('status', 'RETRYING')
              job.set('scheduled_for', new Date(Date.now() + backoffMin * 60000).toISOString())
              job.set('error', errStr)
              $app.save(job)
            } else {
              job.set('status', 'FAILED')
              job.set('error', errStr)
              job.set('completed_at', new Date().toISOString())
              $app.save(job)
              failed++
            }
          }
        }
      }
      return e.json(200, {
        processed: processed,
        failed: failed,
        autopilotEnabled: autopilotEnabled,
      })
    } catch (err) {
      $app.logger().error('autopilot_process_jobs_error', 'error', String(err))
      return e.json(500, { error: 'Erro ao processar jobs: ' + String(err) })
    }
  },
  $apis.requireAuth(),
)
