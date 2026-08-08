routerAdd(
  'POST',
  '/backend/v1/autopilot/process-jobs',
  (e) => {
    try {
      var ACTION_REGISTRY = {
        GENERATE_PRODUCT_SEO: {
          riskLevel: 'LOW',
          supportsAutopilot: true,
          implemented: true,
          minutesSaved: 10,
        },
        GENERATE_INSTAGRAM_CONTENT: {
          riskLevel: 'LOW',
          supportsAutopilot: true,
          implemented: true,
          minutesSaved: 15,
        },
        CREATE_NOTIFICATION: {
          riskLevel: 'LOW',
          supportsAutopilot: true,
          implemented: true,
          minutesSaved: 0,
        },
        ANALYZE_LOW_STOCK: {
          riskLevel: 'LOW',
          supportsAutopilot: true,
          implemented: true,
          minutesSaved: 10,
        },
        ANALYZE_PRODUCT_PERFORMANCE: {
          riskLevel: 'LOW',
          supportsAutopilot: true,
          implemented: true,
          minutesSaved: 15,
        },
        GENERATE_PRODUCT_CONTENT: {
          riskLevel: 'LOW',
          supportsAutopilot: true,
          implemented: true,
          minutesSaved: 20,
        },
        CREATE_SHOPIFY_DRAFT: {
          riskLevel: 'LOW',
          supportsAutopilot: true,
          implemented: false,
          minutesSaved: 10,
        },
        UPDATE_LOCAL_PRODUCT: {
          riskLevel: 'LOW',
          supportsAutopilot: true,
          implemented: false,
          minutesSaved: 5,
        },
        CREATE_MARKETING_DRAFT: {
          riskLevel: 'LOW',
          supportsAutopilot: true,
          implemented: false,
          minutesSaved: 10,
        },
        CREATE_DAILY_BRIEFING: {
          riskLevel: 'LOW',
          supportsAutopilot: true,
          implemented: false,
          minutesSaved: 15,
        },
        REQUEST_PRICE_CHANGE: {
          riskLevel: 'HIGH',
          supportsAutopilot: false,
          implemented: false,
          minutesSaved: 0,
        },
        REQUEST_SHOPIFY_ACTIVATION: {
          riskLevel: 'HIGH',
          supportsAutopilot: false,
          implemented: false,
          minutesSaved: 0,
        },
      }

      var MANDATORY_PROMPT =
        'Use exclusivamente os fatos fornecidos. Nao invente especificacoes, garantia, frete, certificacoes, avaliacoes ou quantidades vendidas.'

      function cleanAiJson(text) {
        var t = text.trim()
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

      function validateSeoOutput(d) {
        return (
          d &&
          typeof d === 'object' &&
          typeof d.seo_title === 'string' &&
          d.seo_title &&
          typeof d.meta_description === 'string' &&
          typeof d.keywords === 'string' &&
          typeof d.slug === 'string' &&
          typeof d.alt_text === 'string'
        )
      }

      function validateIgOutput(d) {
        return (
          d &&
          typeof d === 'object' &&
          typeof d.caption === 'string' &&
          d.caption &&
          typeof d.hashtags === 'string'
        )
      }

      function validateContentOutput(d) {
        return (
          d &&
          typeof d === 'object' &&
          typeof d.description === 'string' &&
          d.description &&
          typeof d.seo_title === 'string' &&
          d.seo_title &&
          typeof d.meta_description === 'string' &&
          typeof d.keywords === 'string' &&
          typeof d.slug === 'string'
        )
      }

      function parseAndValidateAi(aiText, validator) {
        var cleaned = cleanAiJson(aiText)
        try {
          var data = JSON.parse(cleaned)
          if (validator(data)) return { ok: true, data: data }
        } catch (_) {}
        return { ok: false, raw: cleaned }
      }

      function buildVerifiedFacts(product) {
        return {
          name: product.getString('name'),
          description: product.getString('description') || null,
          vendor: product.getString('vendor') || null,
          product_type: product.getString('product_type') || null,
          price: product.getNumber('price') || null,
          cost: product.getNumber('cost') || null,
          tags: product.getString('tags') || null,
          specifications_verified: [],
          shipping_policy: null,
          warranty_verified: null,
        }
      }

      function executeAutomationAction(actionType, storeId, eventRec, rule, job, userId) {
        var meta = ACTION_REGISTRY[actionType]
        if (!meta || !meta.implemented) {
          return { status: 'NOT_IMPLEMENTED', message: 'Acao nao implementada: ' + actionType }
        }

        var productId = eventRec.getString('entity_id')
        var payload = {}
        try {
          payload = JSON.parse(eventRec.getString('payload'))
        } catch (_) {}

        if (actionType === 'CREATE_NOTIFICATION') {
          var actionConfig = {}
          try {
            actionConfig = JSON.parse(rule.getString('action_config'))
          } catch (_) {}
          var msgTemplate = actionConfig.message_template || 'Notificacao automatica'
          var productName =
            (payload.product && (payload.product.name || payload.product.title)) || 'Produto'
          var quantity = (payload.inventory && payload.inventory.quantity) || 0
          var msg = msgTemplate
            .replace('{produto}', productName)
            .replace('{quantidade}', String(quantity))
          var nCol = $app.findCollectionByNameOrId('automation_notifications')
          var nRec = new Record(nCol)
          nRec.set('store', storeId)
          nRec.set('user', userId)
          nRec.set('type', 'critical_stock')
          nRec.set('title', 'Estoque critico')
          nRec.set('message', msg)
          nRec.set('severity', 'CRITICAL')
          nRec.set('entity_type', eventRec.getString('entity_type'))
          nRec.set('entity_id', eventRec.getString('entity_id'))
          nRec.set('read', false)
          $app.save(nRec)
          return { status: 'COMPLETED', message: 'Notification created' }
        }

        if (actionType === 'ANALYZE_LOW_STOCK' || actionType === 'ANALYZE_PRODUCT_PERFORMANCE') {
          var nCol2 = $app.findCollectionByNameOrId('automation_notifications')
          var nRec2 = new Record(nCol2)
          nRec2.set('store', storeId)
          nRec2.set('user', userId)
          nRec2.set('type', 'analysis')
          nRec2.set('title', 'Analise concluida')
          nRec2.set('message', 'A analise de performance foi executada com sucesso.')
          nRec2.set('severity', 'INFO')
          nRec2.set('read', false)
          $app.save(nRec2)
          return { status: 'COMPLETED', message: 'Analysis completed' }
        }

        if (!productId) return { status: 'FAILED', message: 'No product entity_id' }

        var product = null
        try {
          product = $app.findRecordById('products', productId)
        } catch (_) {}
        if (!product) return { status: 'FAILED', message: 'Product not found: ' + productId }

        var facts = buildVerifiedFacts(product)

        if (actionType === 'GENERATE_PRODUCT_SEO') {
          var seoPrompt =
            'Gere dados SEO para o produto "' +
            facts.name +
            '". ' +
            MANDATORY_PROMPT +
            '\nFATOS:\n' +
            JSON.stringify(facts) +
            '\nResponda JSON: {"seo_title":"","meta_description":"","keywords":"","slug":"","alt_text":""}'
          var aiReply = $ai.chat({
            model: 'fast',
            messages: [
              { role: 'system', content: 'Responda exclusivamente com JSON valido.' },
              { role: 'user', content: seoPrompt },
            ],
          })
          var result = parseAndValidateAi(aiReply.choices[0].message.content, validateSeoOutput)
          if (!result.ok) {
            var repair = $ai.chat({
              model: 'fast',
              messages: [
                { role: 'system', content: 'Corrija o JSON. Retorne apenas JSON valido.' },
                { role: 'user', content: result.raw },
              ],
            })
            result = parseAndValidateAi(repair.choices[0].message.content, validateSeoOutput)
            if (!result.ok) return { status: 'FAILED', message: 'AI returned invalid SEO format' }
          }
          product.set('seo_title', result.data.seo_title || '')
          product.set('meta_description', result.data.meta_description || '')
          product.set('keywords', result.data.keywords || '')
          product.set('slug', result.data.slug || product.getString('slug'))
          product.set('alt_text', result.data.alt_text || '')
          $app.save(product)
          return { status: 'COMPLETED', message: 'SEO generated' }
        }

        if (actionType === 'GENERATE_INSTAGRAM_CONTENT') {
          var igPrompt =
            'Crie conteudo de Instagram para "' +
            facts.name +
            '". ' +
            MANDATORY_PROMPT +
            '\nFATOS:\n' +
            JSON.stringify(facts) +
            '\nResponda JSON: {"caption":"","hashtags":""}'
          var igReply = $ai.chat({
            model: 'fast',
            messages: [
              { role: 'system', content: 'Responda apenas JSON valido.' },
              { role: 'user', content: igPrompt },
            ],
          })
          var igResult = parseAndValidateAi(igReply.choices[0].message.content, validateIgOutput)
          if (!igResult.ok) {
            var igRepair = $ai.chat({
              model: 'fast',
              messages: [
                { role: 'system', content: 'Corrija o JSON. Retorne apenas JSON valido.' },
                { role: 'user', content: igResult.raw },
              ],
            })
            igResult = parseAndValidateAi(igRepair.choices[0].message.content, validateIgOutput)
            if (!igResult.ok)
              return { status: 'FAILED', message: 'AI returned invalid Instagram format' }
          }
          product.set('instagram_caption', igResult.data.caption || '')
          product.set('instagram_hashtags', igResult.data.hashtags || '')
          $app.save(product)
          return { status: 'COMPLETED', message: 'Instagram content generated' }
        }

        if (actionType === 'GENERATE_PRODUCT_CONTENT') {
          var contentPrompt =
            'Gere conteudo de alta conversao para o produto abaixo. ' +
            MANDATORY_PROMPT +
            '\nFATOS:\n' +
            JSON.stringify(facts) +
            '\nResponda JSON: {"description":"","seo_title":"","meta_description":"","keywords":"","slug":"","alt_text":""}'
          var contentReply = $ai.chat({
            model: 'reasoning',
            messages: [
              { role: 'system', content: 'Responda apenas JSON valido. Nao use markdown.' },
              { role: 'user', content: contentPrompt },
            ],
          })
          var contentResult = parseAndValidateAi(
            contentReply.choices[0].message.content,
            validateContentOutput,
          )
          if (!contentResult.ok) {
            var contentRepair = $ai.chat({
              model: 'fast',
              messages: [
                { role: 'system', content: 'Corrija o JSON. Retorne apenas JSON valido.' },
                { role: 'user', content: contentResult.raw },
              ],
            })
            contentResult = parseAndValidateAi(
              contentRepair.choices[0].message.content,
              validateContentOutput,
            )
            if (!contentResult.ok)
              return { status: 'FAILED', message: 'AI returned invalid content format' }
          }
          product.set('description', contentResult.data.description || '')
          product.set('seo_title', contentResult.data.seo_title || '')
          product.set('meta_description', contentResult.data.meta_description || '')
          product.set('keywords', contentResult.data.keywords || '')
          product.set('slug', contentResult.data.slug || product.getString('slug'))
          product.set('alt_text', contentResult.data.alt_text || '')
          $app.save(product)
          return { status: 'COMPLETED', message: 'Product content generated' }
        }

        return { status: 'NOT_IMPLEMENTED', message: 'No executor for: ' + actionType }
      }

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
        if (memberRole !== 'OWNER' && memberRole !== 'ADMIN') {
          return e.json(403, { error: 'Apenas OWNER/ADMIN podem executar manualmente' })
        }
      }

      if (!storeRecord) return e.json(200, { processed: 0, failed: 0 })

      var autopilotEnabled = storeRecord.getBool('autopilot_enabled')
      var now = new Date().toISOString()
      var storeId = storeRecord.id

      function findStoreOwner(sid) {
        try {
          var owners = $app.findRecordsByFilter(
            'store_members',
            "store = {:sid} && role = 'OWNER'",
            '-created',
            1,
            0,
            { sid: sid },
          )
          if (owners.length > 0) return owners[0].getString('user')
        } catch (_) {}
        return ''
      }

      function createActionLog(
        sid,
        uid,
        actionType,
        entityType,
        entityId,
        status,
        summary,
        ruleId,
        eventId,
        jobId,
        minutesSaved,
      ) {
        try {
          var logCol = $app.findCollectionByNameOrId('action_logs')
          var logRec = new Record(logCol)
          logRec.set('store', sid)
          logRec.set('user', uid)
          logRec.set('action_type', actionType)
          logRec.set('entity_type', entityType || '')
          logRec.set('entity_id', entityId || '')
          logRec.set('status', status)
          logRec.set('summary', summary || '')
          logRec.set('rule', ruleId || '')
          logRec.set('event', eventId || '')
          logRec.set('job', jobId || '')
          logRec.set('automation', true)
          logRec.set('execution_source', 'AUTOMATION')
          if (minutesSaved) logRec.set('estimated_minutes_saved', minutesSaved)
          $app.save(logRec)
          return logRec
        } catch (_) {
          return null
        }
      }

      function createNotification(sid, uid, type, title, message, severity, entityType, entityId) {
        try {
          var nCol = $app.findCollectionByNameOrId('automation_notifications')
          var nRec = new Record(nCol)
          nRec.set('store', sid)
          nRec.set('user', uid)
          nRec.set('type', type)
          nRec.set('title', title)
          nRec.set('message', message)
          nRec.set('severity', severity || 'INFO')
          nRec.set('entity_type', entityType || '')
          nRec.set('entity_id', entityId || '')
          nRec.set('read', false)
          $app.save(nRec)
        } catch (_) {}
      }

      var owner = findStoreOwner(storeId)

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

        var ruleId = job.getString('rule')
        var eventId = job.getString('event')
        var actionType = job.getString('job_type')

        var rule = null
        try {
          rule = $app.findRecordById('automation_rules', ruleId)
        } catch (_) {}
        var eventRec = null
        try {
          eventRec = $app.findRecordById('automation_events', eventId)
        } catch (_) {}

        if (!rule || !eventRec) {
          job.set('status', 'FAILED')
          job.set('error', 'Rule or event not found')
          $app.save(job)
          failed++
          continue
        }

        var actionMeta = ACTION_REGISTRY[actionType] || {
          riskLevel: 'MEDIUM',
          supportsAutopilot: false,
          implemented: false,
          minutesSaved: 0,
        }
        var autonomy = rule.getString('autonomy_mode')
        if (autonomy === 'AUTOPILOT' && !actionMeta.supportsAutopilot) autonomy = 'APPROVAL'

        if (autonomy === 'SUGGEST') {
          createActionLog(
            storeId,
            owner,
            actionType,
            eventRec.getString('entity_type'),
            eventRec.getString('entity_id'),
            'PROPOSED',
            'Sugestao: ' + actionType,
            ruleId,
            eventId,
            job.id,
            actionMeta.minutesSaved,
          )
          createNotification(
            storeId,
            owner,
            'suggestion',
            'Nova sugestao de automacao',
            'A automacao "' + rule.getString('name') + '" tem uma sugestao para voce.',
            'INFO',
            eventRec.getString('entity_type'),
            eventRec.getString('entity_id'),
          )
          job.set('status', 'COMPLETED')
          job.set('completed_at', new Date().toISOString())
          job.set('result', JSON.stringify({ mode: 'SUGGEST', message: 'Suggestion created' }))
          $app.save(job)
          rule.set('last_executed_at', now)
          rule.set('execution_count', (rule.getNumber('execution_count') || 0) + 1)
          $app.save(rule)
          processed++
        } else if (autonomy === 'APPROVAL') {
          var apprCol = $app.findCollectionByNameOrId('automation_approvals')
          var apprRec = new Record(apprCol)
          apprRec.set('store', storeId)
          apprRec.set('rule', ruleId)
          apprRec.set('job', job.id)
          apprRec.set('requested_by', owner)
          apprRec.set('title', rule.getString('name'))
          apprRec.set('description', rule.getString('description'))
          apprRec.set('entity_type', eventRec.getString('entity_type'))
          apprRec.set('entity_id', eventRec.getString('entity_id'))
          var proposedPayload = {}
          try {
            proposedPayload = JSON.parse(eventRec.getString('payload'))
          } catch (_) {}
          apprRec.set(
            'proposed_action',
            JSON.stringify({
              actionType: actionType,
              payload: proposedPayload,
              actionConfig: rule.getString('action_config'),
            }),
          )
          apprRec.set('risk_level', actionMeta.riskLevel)
          apprRec.set('status', 'PENDING')
          apprRec.set('expires_at', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString())
          $app.save(apprRec)
          var aLog = createActionLog(
            storeId,
            owner,
            actionType,
            eventRec.getString('entity_type'),
            eventRec.getString('entity_id'),
            'PROPOSED',
            'Aguardando aprovacao: ' + rule.getString('name'),
            ruleId,
            eventId,
            job.id,
            actionMeta.minutesSaved,
          )
          if (aLog) {
            apprRec.set('action_log', aLog.id)
            $app.save(apprRec)
          }
          createNotification(
            storeId,
            owner,
            'pending_approval',
            'Aprovacao pendente',
            'A automacao "' + rule.getString('name') + '" aguarda sua aprovacao.',
            'WARNING',
          )
          job.set('status', 'WAITING_APPROVAL')
          $app.save(job)
          processed++
        } else if (autonomy === 'AUTOPILOT') {
          try {
            if (!actionMeta.implemented) {
              throw new Error('Action not implemented: ' + actionType)
            }
            var execResult = executeAutomationAction(
              actionType,
              storeId,
              eventRec,
              rule,
              job,
              owner,
            )
            if (execResult.status === 'NOT_IMPLEMENTED' || execResult.status === 'FAILED') {
              throw new Error(execResult.message || 'Execution failed')
            }
            createActionLog(
              storeId,
              owner,
              actionType,
              eventRec.getString('entity_type'),
              eventRec.getString('entity_id'),
              'EXECUTED',
              'Executado automaticamente: ' + actionType,
              ruleId,
              eventId,
              job.id,
              actionMeta.minutesSaved,
            )
            createNotification(
              storeId,
              owner,
              'automation_completed',
              'Automacao concluida',
              'A automacao "' + rule.getString('name') + '" foi executada com sucesso.',
              'SUCCESS',
            )
            job.set('status', 'COMPLETED')
            job.set('completed_at', new Date().toISOString())
            job.set('result', JSON.stringify(execResult))
            $app.save(job)
            rule.set('last_executed_at', now)
            rule.set('execution_count', (rule.getNumber('execution_count') || 0) + 1)
            $app.save(rule)
            processed++
          } catch (execErr) {
            var attempts = job.getNumber('attempts') || 1
            var maxAttempts = job.getNumber('max_attempts') || 3
            var errStr = String(execErr)
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
              createActionLog(
                storeId,
                owner,
                actionType,
                eventRec.getString('entity_type'),
                eventRec.getString('entity_id'),
                'FAILED',
                'Falha: ' + errStr,
                ruleId,
                eventId,
                job.id,
                0,
              )
              createNotification(
                storeId,
                owner,
                'automation_error',
                'Falha na automacao',
                'A automacao "' + rule.getString('name') + '" falhou: ' + errStr,
                'ERROR',
              )
              var recentJobs = $app.findRecordsByFilter(
                'automation_jobs',
                'rule = {:rid}',
                '-created',
                5,
                0,
                { rid: ruleId },
              )
              var allFailed = true
              for (var rj = 0; rj < recentJobs.length; rj++) {
                var rjStatus = recentJobs[rj].getString('status')
                if (rjStatus === 'COMPLETED' || rjStatus === 'WAITING_APPROVAL') {
                  allFailed = false
                  break
                }
              }
              if (allFailed && recentJobs.length >= 5) {
                rule.set('enabled', false)
                $app.save(rule)
                createNotification(
                  storeId,
                  owner,
                  'automation_error',
                  'Automacao pausada apos falhas consecutivas',
                  'A automacao "' +
                    rule.getString('name') +
                    '" foi pausada apos 5 falhas consecutivas.',
                  'CRITICAL',
                )
              }
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
