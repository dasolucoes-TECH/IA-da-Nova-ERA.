cronAdd('autopilot_worker', '* * * * *', () => {
  try {
    var now = new Date().toISOString()

    try {
      var staleJobs = $app.findRecordsByFilter('automation_jobs', 'status = {:st}', '-created', 50, 0, { st: 'RUNNING' })
      var staleThreshold = new Date(Date.now() - 5 * 60 * 1000)
      for (var s = 0; s < staleJobs.length; s++) {
        var startedAt = staleJobs[s].getString('started_at')
        if (startedAt && new Date(startedAt) < staleThreshold) {
          staleJobs[s].set('status', 'RETRYING')
          staleJobs[s].set('scheduled_for', now)
          staleJobs[s].set('error', 'Recovered from stale RUNNING state')
          $app.save(staleJobs[s])
        }
      }
    } catch (_) {}

    function delegateExecute(jobId) {
      var baseUrl = $secrets.get('PB_INSTANCE_URL') || ''
      var secret = $secrets.get('AUTOPILOT_INTERNAL_SECRET') || ''
      var res = $http.send({
        url: baseUrl + '/backend/v1/autopilot/execute-action',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Internal-Secret': secret },
        body: JSON.stringify({ jobId: jobId }),
        timeout: 120,
      })
      if (res.statusCode === 200 && res.json) return res.json
      return { status: 'FAILED', message: 'execute-action HTTP ' + res.statusCode }
    }

    var UNSAFE = ['REQUEST_PRICE_CHANGE', 'REQUEST_SHOPIFY_ACTIVATION']
    var IMPL = ['GENERATE_PRODUCT_SEO', 'GENERATE_INSTAGRAM_CONTENT', 'CREATE_NOTIFICATION', 'ANALYZE_LOW_STOCK', 'ANALYZE_PRODUCT_PERFORMANCE', 'GENERATE_PRODUCT_CONTENT']
    var stores = $app.findRecordsByFilter('stores', 'autopilot_enabled = true', '-created', 100, 0)

    for (var si = 0; si < stores.length; si++) {
      var storeId = stores[si].id
      var jobs = []
      try {
        jobs = $app.findRecordsByFilter('automation_jobs', 'store = {:sid} && (status = {:s1} || status = {:s2}) && scheduled_for <= {:now}', '-priority,created', 10, 0, { sid: storeId, s1: 'QUEUED', s2: 'RETRYING', now: now })
      } catch (_) {
        try {
          jobs = $app.findRecordsByFilter('automation_jobs', 'store = {:sid} && (status = {:s1} || status = {:s2})', '-priority,created', 10, 0, { sid: storeId, s1: 'QUEUED', s2: 'RETRYING' })
          jobs = jobs.filter(function (j) { var sf = j.getString('scheduled_for'); return !sf || new Date(sf) <= new Date(now) })
        } catch (_2) {}
      }

      for (var i = 0; i < jobs.length; i++) {
        var job = jobs[i]
        var cs = job.getString('status')
        if (cs !== 'QUEUED' && cs !== 'RETRYING') continue

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
        } catch (_) { continue }

        var rule = null, eventRec = null
        try { rule = $app.findRecordById('automation_rules', job.getString('rule')) } catch (_) {}
        try { eventRec = $app.findRecordById('automation_events', job.getString('event')) } catch (_) {}
        if (!rule || !eventRec) {
          job.set('status', 'FAILED')
          job.set('error', 'Rule or event not found')
          job.set('completed_at', new Date().toISOString())
          $app.save(job)
          continue
        }

        var actionType = job.getString('job_type')
        var autonomy = rule.getString('autonomy_mode')
        if (autonomy === 'AUTOPILOT' && UNSAFE.indexOf(actionType) !== -1) autonomy = 'APPROVAL'

        if (autonomy === 'SUGGEST') {
          try {
            var owner = ''
            try { var owners = $app.findRecordsByFilter('store_members', "store = {:sid} && role = 'OWNER'", '-created', 1, 0, { sid: storeId }); if (owners.length > 0) owner = owners[0].getString('user') } catch (_) {}
            var logCol = $app.findCollectionByNameOrId('action_logs')
            var logRec = new Record(logCol)
            logRec.set('store', storeId); logRec.set('user', owner); logRec.set('action_type', actionType)
            logRec.set('entity_type', eventRec.getString('entity_type') || ''); logRec.set('entity_id', eventRec.getString('entity_id') || '')
            logRec.set('status', 'PROPOSED'); logRec.set('summary', 'Sugestao: ' + actionType)
            logRec.set('rule', rule.id); logRec.set('event', eventRec.id); logRec.set('job', job.id)
            logRec.set('automation', true); logRec.set('execution_source', 'AUTOMATION')
            $app.save(logRec)
            var nCol = $app.findCollectionByNameOrId('automation_notifications')
            var nRec = new Record(nCol)
            nRec.set('store', storeId); nRec.set('user', owner); nRec.set('type', 'suggestion')
            nRec.set('title', 'Nova sugestao de automacao')
            nRec.set('message', 'A automacao "' + rule.getString('name') + '" tem uma sugestao para voce.')
            nRec.set('severity', 'INFO'); nRec.set('read', false)
            $app.save(nRec)
          } catch (_) {}
          job.set('status', 'COMPLETED'); job.set('completed_at', new Date().toISOString())
          job.set('result', JSON.stringify({ mode: 'SUGGEST', message: 'Suggestion created' }))
          $app.save(job)
          rule.set('last_executed_at', now); rule.set('execution_count', (rule.getNumber('execution_count') || 0) + 1)
          $app.save(rule)
        } else if (autonomy === 'APPROVAL') {
          try {
            var apprCol = $app.findCollectionByNameOrId('automation_approvals')
            var apprRec = new Record(apprCol)
            apprRec.set('store', storeId); apprRec.set('rule', rule.id); apprRec.set('job', job.id)
            apprRec.set('title', rule.getString('name')); apprRec.set('description', rule.getString('description') || '')
            apprRec.set('entity_type', eventRec.getString('entity_type') || ''); apprRec.set('entity_id', eventRec.getString('entity_id') || '')
            var pp = {}; try { pp = JSON.parse(eventRec.getString('payload')) } catch (_) {}
            apprRec.set('proposed_action', JSON.stringify({ actionType: actionType, payload: pp }))
            apprRec.set('risk_level', IMPL.indexOf(actionType) !== -1 ? 'LOW' : 'MEDIUM')
            apprRec.set('status', 'PENDING'); apprRec.set('expires_at', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString())
            $app.save(apprRec)
          } catch (_) {}
          job.set('status', 'WAITING_APPROVAL'); $app.save(job)
        } else if (autonomy === 'AUTOPILOT') {
          var execResult = delegateExecute(job.id)
          if (execResult.status === 'COMPLETED') {
            job.set('status', 'COMPLETED'); job.set('completed_at', new Date().toISOString())
            job.set('result', JSON.stringify(execResult)); $app.save(job)
            rule.set('last_executed_at', now); rule.set('execution_count', (rule.getNumber('execution_count') || 0) + 1)
            $app.save(rule)
          } else if (execResult.status === 'NOT_IMPLEMENTED') {
            job.set('status', 'FAILED'); job.set('error', execResult.message)
            job.set('completed_at', new Date().toISOString()); $app.save(job)
          } else {
            var attempts = job.getNumber('attempts') || 1
            var maxAttempts = job.getNumber('max_attempts') || 3
            var errStr = execResult.message || 'Execution failed'
            var isRetryable = errStr.indexOf('429') !== -1 || errStr.indexOf('timeout') !== -1 || errStr.indexOf('SkipAi') !== -1 || errStr.indexOf('500') !== -1
            if (isRetryable && attempts < maxAttempts) {
              var backoffMin = attempts === 1 ? 1 : attempts === 2 ? 5 : 15
              job.set('status', 'RETRYING'); job.set('scheduled_for', new Date(Date.now() + backoffMin * 60000).toISOString())
              job.set('error', errStr); $app.save(job)
            } else {
              job.set('status', 'FAILED'); job.set('error', errStr)
              job.set('completed_at', new Date().toISOString()); $app.save(job)
              try {
                var recentTerminal = $app.findRecordsByFilter('automation_jobs', 'rule = {:rid} && (status = {:s1} || status = {:s2} || status = {:s3})', '-created', 5, 0, { rid: rule.id, s1: 'COMPLETED', s2: 'FAILED', s3: 'CANCELLED' })
                var allFailed = true
                for (var rj = 0; rj < recentTerminal.length; rj++) { if (recentTerminal[rj].getString('status') !== 'FAILED') { allFailed = false; break } }
                if (allFailed && recentTerminal.length >= 5) {
                  rule.set('enabled', false); $app.save(rule)
                  try {
                    var nc = $app.findCollectionByNameOrId('automation_notifications'); var nr = new Record(nc)
                    nr.set('store', storeId); nr.set('type', 'circuit_breaker')
                    nr.set('title', 'Automação pausada após múltiplas falhas.')
                    nr.set('message', 'A automacao "' + rule.getString('name') + '" foi pausada apos 5 falhas consecutivas.')
                    nr.set('severity', 'CRITICAL'); nr.set('read', false); $app.save(nr)
                  } catch (_) {}
                }
              } catch (_) {}
            }
          }
        }
      }
    }
  } catch (err) {
    $app.logger().error('autopilot_worker_error', 'error', String(err))
  }
})
