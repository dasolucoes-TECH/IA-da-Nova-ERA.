routerAdd('POST', '/backend/v1/autopilot/approvals/{id}/approve', (e) => {
  try {
    var userId = e.auth ? e.auth.id : ''
    if (!userId) return e.unauthorizedError('Autenticacao necessaria')
    var storeRecord = null
    var memberRole = ''
    try {
      var members = $app.findRecordsByFilter('store_members', 'user = {:uid}', '-created', 1, 0, { uid: userId })
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
      approval.set('status', 'EXPIRED'); $app.save(approval)
      return e.json(410, { error: 'Aprovacao expirada' })
    }

    var jobId = approval.getString('job')
    if (!jobId)
      return e.json(200, { approved: true, executionStatus: 'COMPLETED', message: 'Aprovada sem job associado.' })

    var job = null
    try { job = $app.findRecordById('automation_jobs', jobId) } catch (_) {}
    if (!job)
      return e.json(200, { approved: true, executionStatus: 'FAILED', message: 'Job nao encontrado.' })

    var jobStatus = job.getString('status')
    if (jobStatus === 'COMPLETED')
      return e.json(200, { approved: true, executionStatus: 'COMPLETED', message: 'Job ja foi executado.' })
    if (jobStatus === 'RUNNING') return e.json(409, { error: 'Job ja esta em execucao' })

    approval.set('status', 'APPROVED'); approval.set('approved_by', userId)
    approval.set('approved_at', new Date().toISOString()); $app.save(approval)
    $app.logger().info('approval_approved', 'approvalId', approvalId, 'userId', userId)

    job.set('status', 'RUNNING'); job.set('started_at', new Date().toISOString())
    job.set('attempts', (job.getNumber('attempts') || 0) + 1); $app.save(job)

    var storeId = storeRecord.id
    var ruleId = job.getString('rule')

    function delegateExecute(jid) {
      var baseUrl = $secrets.get('PB_INSTANCE_URL') || ''
      var secret = $secrets.get('AUTOPILOT_INTERNAL_SECRET') || ''
      var res = $http.send({
        url: baseUrl + '/backend/v1/autopilot/execute-action',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Internal-Secret': secret },
        body: JSON.stringify({ jobId: jid }),
        timeout: 120,
      })
      if (res.statusCode === 200 && res.json) return res.json
      return { status: 'FAILED', message: 'execute-action HTTP ' + res.statusCode }
    }

    var execResult = delegateExecute(jobId)
    var rule = null
    try { rule = $app.findRecordById('automation_rules', ruleId) } catch (_) {}

    if (execResult.status === 'COMPLETED') {
      job.set('status', 'COMPLETED'); job.set('completed_at', new Date().toISOString())
      job.set('result', JSON.stringify({ approved: true, executedAt: new Date().toISOString(), execResult: execResult }))
      $app.save(job)
      if (rule) {
        rule.set('last_executed_at', new Date().toISOString())
        rule.set('execution_count', (rule.getNumber('execution_count') || 0) + 1)
        $app.save(rule)
      }
      try {
        var nCol = $app.findCollectionByNameOrId('automation_notifications')
        var nRec = new Record(nCol)
        nRec.set('store', storeId); nRec.set('user', userId); nRec.set('type', 'approval_resolved')
        nRec.set('title', 'Aprovacao concluida')
        nRec.set('message', 'A acao "' + approval.getString('title') + '" foi aprovada e executada com sucesso.')
        nRec.set('severity', 'SUCCESS'); nRec.set('read', false); $app.save(nRec)
      } catch (_) {}
      return e.json(200, { approved: true, executionStatus: 'COMPLETED' })
    } else {
      job.set('status', 'FAILED'); job.set('error', execResult.message || 'Execution failed')
      job.set('completed_at', new Date().toISOString()); $app.save(job)
      try {
        var nCol2 = $app.findCollectionByNameOrId('automation_notifications')
        var nRec2 = new Record(nCol2)
        nRec2.set('store', storeId); nRec2.set('user', userId); nRec2.set('type', 'approval_failed')
        nRec2.set('title', 'Falha na execucao')
        nRec2.set('message', 'A acao "' + approval.getString('title') + '" foi aprovada, mas a execucao falhou: ' + (execResult.message || ''))
        nRec2.set('severity', 'ERROR'); nRec2.set('read', false); $app.save(nRec2)
      } catch (_) {}
      return e.json(200, { approved: true, executionStatus: 'FAILED', message: 'A acao foi aprovada, mas a execucao falhou.' })
    }
  } catch (err) {
    return e.internalServerError('Erro: ' + String(err))
  }
}, $apis.requireAuth())
