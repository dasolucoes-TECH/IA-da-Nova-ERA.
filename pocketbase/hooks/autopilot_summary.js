routerAdd(
  'GET',
  '/backend/v1/autopilot/summary',
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

      var todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)

      var activeRules = 0
      try {
        var rules = $app.findRecordsByFilter(
          'automation_rules',
          'store = {:sid} && enabled = true',
          '-created',
          100,
          0,
          { sid: storeRecord.id },
        )
        activeRules = rules.length
      } catch (_) {}

      var executionsToday = 0
      var failedToday = 0
      var estimatedMinutesSaved = 0
      try {
        var todayJobs = $app.findRecordsByFilter(
          'automation_jobs',
          'store = {:sid} && created >= {:ts}',
          '-created',
          200,
          0,
          { sid: storeRecord.id, ts: todayStart.toISOString() },
        )
        for (var i = 0; i < todayJobs.length; i++) {
          var st = todayJobs[i].getString('status')
          if (st === 'COMPLETED') executionsToday++
          if (st === 'FAILED') failedToday++
        }
      } catch (_) {}

      try {
        var todayLogs = $app.findRecordsByFilter(
          'action_logs',
          'store = {:sid} && created >= {:ts} && automation = true',
          '-created',
          200,
          0,
          { sid: storeRecord.id, ts: todayStart.toISOString() },
        )
        for (var j = 0; j < todayLogs.length; j++) {
          estimatedMinutesSaved += todayLogs[j].getNumber('estimated_minutes_saved') || 0
        }
      } catch (_) {}

      var pendingApprovals = 0
      try {
        var approvals = $app.findRecordsByFilter(
          'automation_approvals',
          'store = {:sid} && status = {:st}',
          '-created',
          100,
          0,
          { sid: storeRecord.id, st: 'PENDING' },
        )
        pendingApprovals = approvals.length
      } catch (_) {}

      var lastExecution = null
      try {
        var lastJobs = $app.findRecordsByFilter(
          'automation_jobs',
          'store = {:sid}',
          '-created',
          1,
          0,
          { sid: storeRecord.id },
        )
        if (lastJobs.length > 0) {
          lastExecution = {
            id: lastJobs[0].id,
            status: lastJobs[0].getString('status'),
            jobType: lastJobs[0].getString('job_type'),
            completedAt: lastJobs[0].getString('completed_at'),
            createdAt: lastJobs[0].getString('created'),
          }
        }
      } catch (_) {}

      return e.json(200, {
        activeRules: activeRules,
        executionsToday: executionsToday,
        pendingApprovals: pendingApprovals,
        failedToday: failedToday,
        estimatedMinutesSaved: estimatedMinutesSaved,
        lastExecution: lastExecution,
        autopilotEnabled: storeRecord.getBool('autopilot_enabled'),
      })
    } catch (err) {
      return e.internalServerError('Erro: ' + String(err))
    }
  },
  $apis.requireAuth(),
)
