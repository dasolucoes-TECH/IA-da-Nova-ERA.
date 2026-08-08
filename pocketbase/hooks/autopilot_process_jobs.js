routerAdd('POST', '/backend/v1/autopilot/process-jobs', (e) => {
  try {
    var body = e.requestInfo().body || {}
    var isWorker = !!body.worker
    var storeRecord = null
    var memberRole = ''

    if (isWorker && body.storeId) {
      try { storeRecord = $app.findRecordById('stores', body.storeId) } catch (_) {}
    } else {
      var userId = e.auth ? e.auth.id : ''
      if (!userId) return e.unauthorizedError('Autenticacao necessaria')
      try {
        var members = $app.findRecordsByFilter('store_members', 'user = {:uid}', '-created', 1, 0, { uid: userId })
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

    var jobs = []
    try {
      jobs = $app.findRecordsByFilter('automation_jobs', 'store = {:sid} && (status = {:s1} || status = {:s2})', '-priority,created', 10, 0, { sid: storeId, s1: 'QUEUED', s2: 'RETRYING' })
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
          txJob.set('status', 'RUNNING'); txJob.set('started_at', now)
          txJob.set('attempts', (txJob.getNumber('attempts') || 0) + 1)
          txApp.save(txJob)
        })
      } catch (_) { continue }

      var rule = null, eventRec = null
      try { rule = $app.findRecordById('automation_rules', job.getString('rule')) } catch (_) {}
      try { eventRec = $app.findRecordById('automation_events', job.getString('event')) } catch (_) {}
      if (!rule || !eventRec) {
        job.set('status', 'FAILED'); job.set('error', 'Rule or event not found'); $app.save(job)
        failed++
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
        processed++
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
        processed++
      } else if (autonomy === 'AUTOPILOT') {
        var execResult = delegateExecute(job.id)
        if (execResult.status === 'COMPLETED') {
          job.set('status', 'COMPLETED'); job.set('completed_at', new Date().toISOString())
          job.set('result', JSON.stringify(execResult)); $app.save(job)
          rule.set('last_executed_at', now); rule.set('execution_count', (rule.getNumber('execution_count') || 0) + 1)
          $app.save(rule)
          processed++
        } else if (execResult.status === 'NOT_IMPLEMENTED') {
          job.set('status', 'FAILED'); job.set('error', execResult.message)
          job.set('completed_at', new Date().toISOString()); $app.save(job)
          failed++
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
            failed++
          }
        }
      }
    }
    return e.json(200, { processed: processed, failed: failed, autopilotEnabled: autopilotEnabled })
  } catch (err) {
    $app.logger().error('autopilot_process_jobs_error', 'error', String(err))
    return e.json(500, { error: 'Erro ao processar jobs: ' + String(err) })
  }
}, $apis.requireAuth())
