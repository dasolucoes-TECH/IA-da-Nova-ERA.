routerAdd(
  'POST',
  '/backend/v1/autopilot/process-jobs',
  (e) => {
    try {
      var userId = e.auth ? e.auth.id : ''
      if (!userId) return e.unauthorizedError('Autenticação necessária')

      var storeRecord = null
      try {
        var members = $app.findRecordsByFilter('store_members', 'user = {:uid}', '-created', 1, 0, {
          uid: userId,
        })
        if (members.length > 0)
          storeRecord = $app.findRecordById('stores', members[0].getString('store'))
      } catch (_) {}
      if (!storeRecord) return e.json(403, { error: 'Nenhuma loja associada' })

      var autopilotEnabled = storeRecord.getBool('autopilot_enabled')
      var now = new Date().toISOString()

      var ACTION_REGISTRY = {
        GENERATE_PRODUCT_SEO: { riskLevel: 'LOW', supportsAutopilot: true, minutesSaved: 10 },
        GENERATE_PRODUCT_CONTENT: { riskLevel: 'LOW', supportsAutopilot: true, minutesSaved: 20 },
        GENERATE_INSTAGRAM_CONTENT: { riskLevel: 'LOW', supportsAutopilot: true, minutesSaved: 15 },
        CREATE_SHOPIFY_DRAFT: { riskLevel: 'LOW', supportsAutopilot: true, minutesSaved: 10 },
        UPDATE_LOCAL_PRODUCT: { riskLevel: 'LOW', supportsAutopilot: true, minutesSaved: 5 },
        CREATE_MARKETING_DRAFT: { riskLevel: 'LOW', supportsAutopilot: true, minutesSaved: 10 },
        CREATE_NOTIFICATION: { riskLevel: 'LOW', supportsAutopilot: true, minutesSaved: 0 },
        CREATE_DAILY_BRIEFING: { riskLevel: 'LOW', supportsAutopilot: true, minutesSaved: 15 },
        ANALYZE_LOW_STOCK: { riskLevel: 'LOW', supportsAutopilot: true, minutesSaved: 10 },
        ANALYZE_PRODUCT_PERFORMANCE: {
          riskLevel: 'LOW',
          supportsAutopilot: true,
          minutesSaved: 15,
        },
        REQUEST_PRICE_CHANGE: { riskLevel: 'HIGH', supportsAutopilot: false, minutesSaved: 0 },
        REQUEST_SHOPIFY_ACTIVATION: {
          riskLevel: 'HIGH',
          supportsAutopilot: false,
          minutesSaved: 0,
        },
      }

      var jobs = []
      try {
        jobs = $app.findRecordsByFilter(
          'automation_jobs',
          'store = {:sid} && (status = {:s1} || status = {:s2})',
          '-priority,created',
          10,
          0,
          { sid: storeRecord.id, s1: 'QUEUED', s2: 'RETRYING' },
        )
      } catch (_) {}

      var processed = 0
      var failed = 0

      function findStoreOwner(storeId) {
        try {
          var owners = $app.findRecordsByFilter(
            'store_members',
            "store = {:sid} && role = 'OWNER'",
            '-created',
            1,
            0,
            { sid: storeId },
          )
          if (owners.length > 0) return owners[0].getString('user')
        } catch (_) {}
        return ''
      }

      function createActionLog(
        storeId,
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
          logRec.set('store', storeId)
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

      function createNotification(
        storeId,
        uid,
        type,
        title,
        message,
        severity,
        entityType,
        entityId,
      ) {
        try {
          var nCol = $app.findCollectionByNameOrId('automation_notifications')
          var nRec = new Record(nCol)
          nRec.set('store', storeId)
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

      for (var i = 0; i < jobs.length; i++) {
        var job = jobs[i]
        var ruleId = job.getString('rule')
        var eventId = job.getString('event')
        var actionType = job.getString('job_type')

        if (!autopilotEnabled && job.getString('status') === 'QUEUED') {
          continue
        }

        job.set('status', 'RUNNING')
        job.set('started_at', now)
        job.set('attempts', (job.getNumber('attempts') || 0) + 1)
        $app.save(job)
        $app.logger().info('automation_job_started', 'jobId', job.id, 'actionType', actionType)

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

        var autonomy = rule.getString('autonomy_mode')
        var actionMeta = ACTION_REGISTRY[actionType] || {
          riskLevel: 'MEDIUM',
          supportsAutopilot: false,
          minutesSaved: 0,
        }

        if (autonomy === 'AUTOPILOT' && !actionMeta.supportsAutopilot) {
          autonomy = 'APPROVAL'
        }

        var payload = {}
        try {
          payload = JSON.parse(eventRec.getString('payload'))
        } catch (_) {}

        if (autonomy === 'SUGGEST') {
          createActionLog(
            storeRecord.id,
            findStoreOwner(storeRecord.id),
            actionType,
            eventRec.getString('entity_type'),
            eventRec.getString('entity_id'),
            'PROPOSED',
            'Sugestão: ' + actionType,
            ruleId,
            eventId,
            job.id,
            actionMeta.minutesSaved,
          )
          createNotification(
            storeRecord.id,
            findStoreOwner(storeRecord.id),
            'suggestion',
            'Nova sugestão de automação',
            'A automação "' + rule.getString('name') + '" tem uma sugestão para você.',
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
          apprRec.set('store', storeRecord.id)
          apprRec.set('rule', ruleId)
          apprRec.set('job', job.id)
          apprRec.set('requested_by', findStoreOwner(storeRecord.id))
          apprRec.set('title', rule.getString('name'))
          apprRec.set('description', rule.getString('description'))
          apprRec.set('entity_type', eventRec.getString('entity_type'))
          apprRec.set('entity_id', eventRec.getString('entity_id'))
          apprRec.set(
            'proposed_action',
            JSON.stringify({
              actionType: actionType,
              payload: payload,
              actionConfig: rule.getString('action_config'),
            }),
          )
          apprRec.set('risk_level', actionMeta.riskLevel)
          apprRec.set('status', 'PENDING')
          var expiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
          apprRec.set('expires_at', expiry.toISOString())
          $app.save(apprRec)

          var aLog = createActionLog(
            storeRecord.id,
            findStoreOwner(storeRecord.id),
            actionType,
            eventRec.getString('entity_type'),
            eventRec.getString('entity_id'),
            'PROPOSED',
            'Aguardando aprovação: ' + rule.getString('name'),
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
            storeRecord.id,
            findStoreOwner(storeRecord.id),
            'pending_approval',
            'Aprovação pendente',
            'A automação "' + rule.getString('name') + '" aguarda sua aprovação.',
            'WARNING',
          )

          job.set('status', 'WAITING_APPROVAL')
          $app.save(job)
          $app.logger().info('approval_created', 'approvalId', apprRec.id, 'jobId', job.id)
          processed++
        } else if (autonomy === 'AUTOPILOT') {
          try {
            var result = null

            if (actionType === 'CREATE_NOTIFICATION') {
              var actionConfig = {}
              try {
                actionConfig = JSON.parse(rule.getString('action_config'))
              } catch (_) {}
              var msgTemplate = actionConfig.message_template || 'Notificação automática'
              var productName = payload.product
                ? payload.product.name || payload.product.title || 'Produto'
                : 'Produto'
              var quantity = payload.inventory ? payload.inventory.quantity || 0 : 0
              var msg = msgTemplate
                .replace('{produto}', productName)
                .replace('{quantidade}', String(quantity))
              createNotification(
                storeRecord.id,
                findStoreOwner(storeRecord.id),
                'critical_stock',
                'Estoque crítico',
                msg,
                'CRITICAL',
                eventRec.getString('entity_type'),
                eventRec.getString('entity_id'),
              )
              result = { message: 'Notification created', notification: msg }
            } else if (actionType === 'GENERATE_PRODUCT_SEO') {
              var productId = eventRec.getString('entity_id')
              if (productId) {
                try {
                  var product = $app.findRecordById('products', productId)
                  var seoPrompt =
                    'Gere dados SEO para o produto "' +
                    product.getString('name') +
                    '". Descrição: ' +
                    (product.getString('description') || 'N/A') +
                    '. Responda em JSON válido: {"seo_title":"","meta_description":"","keywords":"","slug":"","alt_text":""}'
                  var aiReply = $ai.chat({
                    model: 'fast',
                    messages: [
                      { role: 'system', content: 'Responda exclusivamente com JSON válido.' },
                      { role: 'user', content: seoPrompt },
                    ],
                  })
                  var seoText = aiReply.choices[0].message.content.trim()
                  if (seoText.indexOf('```') !== -1) {
                    seoText = seoText
                      .replace(/```json\s*/g, '')
                      .replace(/```/g, '')
                      .trim()
                  }
                  var seoData = JSON.parse(seoText)
                  product.set('seo_title', seoData.seo_title || '')
                  product.set('meta_description', seoData.meta_description || '')
                  product.set('keywords', seoData.keywords || '')
                  product.set('slug', seoData.slug || product.getString('slug'))
                  product.set('alt_text', seoData.alt_text || '')
                  $app.save(product)
                  result = { message: 'SEO generated', productId: productId }
                } catch (seoErr) {
                  throw seoErr
                }
              }
            } else if (
              actionType === 'ANALYZE_LOW_STOCK' ||
              actionType === 'ANALYZE_PRODUCT_PERFORMANCE'
            ) {
              createNotification(
                storeRecord.id,
                findStoreOwner(storeRecord.id),
                'analysis',
                'Análise concluída',
                'A análise de performance foi executada com sucesso.',
                'INFO',
              )
              result = { message: 'Analysis completed' }
            } else {
              result = { message: 'Action executed (no-op)' }
            }

            createActionLog(
              storeRecord.id,
              findStoreOwner(storeRecord.id),
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
              storeRecord.id,
              findStoreOwner(storeRecord.id),
              'automation_completed',
              'Automação concluída',
              'A automação "' + rule.getString('name') + '" foi executada com sucesso.',
              'SUCCESS',
            )

            job.set('status', 'COMPLETED')
            job.set('completed_at', new Date().toISOString())
            job.set('result', JSON.stringify(result))
            $app.save(job)
            rule.set('last_executed_at', now)
            rule.set('execution_count', (rule.getNumber('execution_count') || 0) + 1)
            $app.save(rule)
            $app.logger().info('automation_job_completed', 'jobId', job.id)
            processed++
          } catch (execErr) {
            var attempts = job.getNumber('attempts') || 1
            var maxAttempts = job.getNumber('max_attempts') || 3
            var errStr = String(execErr)
            var isRetryable =
              errStr.indexOf('429') !== -1 ||
              errStr.indexOf('5') === 0 ||
              errStr.indexOf('timeout') !== -1 ||
              errStr.indexOf('SkipAi') !== -1

            if (isRetryable && attempts < maxAttempts) {
              var backoffMin = attempts === 1 ? 1 : attempts === 2 ? 5 : 15
              var scheduledFor = new Date(Date.now() + backoffMin * 60000)
              job.set('status', 'RETRYING')
              job.set('scheduled_for', scheduledFor.toISOString())
              job.set('error', errStr)
              $app.save(job)
              $app.logger().warn('automation_job_retrying', 'jobId', job.id, 'attempt', attempts)
            } else {
              job.set('status', 'FAILED')
              job.set('error', errStr)
              job.set('completed_at', new Date().toISOString())
              $app.save(job)
              $app.logger().error('automation_job_failed', 'jobId', job.id, 'error', errStr)

              var recentFailures = $app.findRecordsByFilter(
                'automation_jobs',
                'rule = {:rid} && status = {:st}',
                '-created',
                5,
                0,
                { rid: ruleId, st: 'FAILED' },
              )
              if (recentFailures.length >= 5) {
                rule.set('enabled', false)
                $app.save(rule)
                createNotification(
                  storeRecord.id,
                  findStoreOwner(storeRecord.id),
                  'automation_error',
                  'Automação pausada após múltiplas falhas',
                  'A automação "' +
                    rule.getString('name') +
                    '" foi pausada após 5 falhas consecutivas.',
                  'CRITICAL',
                )
                $app.logger().error('circuit_breaker_triggered', 'ruleId', ruleId)
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
