routerAdd('POST', '/backend/v1/autopilot/emit-event-core', (e) => {
  try {
    var providedSecret = e.request.header.get('X-Internal-Secret') || ''
    var expectedSecret = $secrets.get('PB_SUPERUSER_TOKEN') || ''
    if (!expectedSecret || providedSecret !== expectedSecret) {
      return e.unauthorizedError('Internal only')
    }

    var body = e.requestInfo().body || {}
    var storeId = body.storeId || ''
    var eventType = body.eventType || ''
    var source = body.source || 'api'
    var entityType = body.entityType || ''
    var entityId = body.entityId || ''
    var payload = body.payload || {}
    var dedupKey = body.deduplicationKey || ''

    if (!storeId || !eventType) {
      return e.badRequestError('storeId and eventType are required')
    }

    var now = new Date().toISOString()

    if (dedupKey) {
      try {
        var existing = $app.findFirstRecordByFilter(
          'automation_events',
          'deduplication_key = {:dk}',
          { dk: dedupKey },
        )
        if (existing)
          return e.json(200, { status: 'duplicate', eventId: existing.id, jobsCreated: 0 })
      } catch (_) {}
    }

    var eventsCol = $app.findCollectionByNameOrId('automation_events')
    var eventRec = new Record(eventsCol)
    eventRec.set('store', storeId)
    eventRec.set('event_type', eventType)
    eventRec.set('source', source)
    eventRec.set('entity_type', entityType)
    eventRec.set('entity_id', entityId)
    eventRec.set('payload', JSON.stringify(payload))
    if (dedupKey) eventRec.set('deduplication_key', dedupKey)
    eventRec.set('status', 'PROCESSING')
    eventRec.set('received_at', now)
    $app.save(eventRec)

    var rules = []
    try {
      rules = $app.findRecordsByFilter(
        'automation_rules',
        'store = {:sid} && enabled = true && trigger_type = {:tt}',
        '-priority',
        50,
        0,
        { sid: storeId, tt: eventType },
      )
    } catch (_) {}

    function getNestedValue(obj, path) {
      var parts = path.split('.')
      var current = obj
      for (var i = 0; i < parts.length; i++) {
        if (current === null || current === undefined) return undefined
        current = current[parts[i]]
      }
      return current
    }

    function evaluateCondition(cond, p) {
      if (!cond || !cond.field) return true
      var val = getNestedValue(p, cond.field)
      switch (cond.operator) {
        case 'equals':
          return val === cond.value
        case 'not_equals':
          return val !== cond.value
        case 'greater_than':
          return Number(val) > Number(cond.value)
        case 'greater_or_equal':
          return Number(val) >= Number(cond.value)
        case 'less_than':
          return Number(val) < Number(cond.value)
        case 'less_or_equal':
          return Number(val) <= Number(cond.value)
        case 'contains':
          return String(val || '').indexOf(String(cond.value)) !== -1
        case 'not_contains':
          return String(val || '').indexOf(String(cond.value)) === -1
        case 'is_empty':
          return !val || val === '' || val === null || val === undefined
        case 'is_not_empty':
          return !!val && val !== ''
        case 'in':
          return Array.isArray(cond.value) && cond.value.indexOf(val) !== -1
        case 'not_in':
          return Array.isArray(cond.value) && cond.value.indexOf(val) === -1
        default:
          return false
      }
    }

    function evaluateConditions(conditions, p) {
      if (!conditions) return true
      if (conditions.all) {
        for (var i = 0; i < conditions.all.length; i++) {
          if (!evaluateCondition(conditions.all[i], p)) return false
        }
        return true
      }
      if (conditions.any) {
        for (var j = 0; j < conditions.any.length; j++) {
          if (evaluateCondition(conditions.any[j], p)) return true
        }
        return false
      }
      return evaluateCondition(conditions, p)
    }

    var jobsCol = $app.findCollectionByNameOrId('automation_jobs')
    var jobsCreated = 0

    for (var r = 0; r < rules.length; r++) {
      var rule = rules[r]
      var conditionsStr = rule.getString('conditions')
      var conditions = null
      try {
        conditions = JSON.parse(conditionsStr)
      } catch (_) {}
      if (!evaluateConditions(conditions, payload)) continue

      var cooldownMin = rule.getNumber('cooldown_minutes') || 0
      if (cooldownMin > 0 && entityId) {
        var cooldownActive = false
        try {
          var lastJobs = $app.findRecordsByFilter(
            'automation_jobs',
            'rule = {:rid} && (status = {:s1} || status = {:s2})',
            '-created',
            50,
            0,
            { rid: rule.id, s1: 'COMPLETED', s2: 'WAITING_APPROVAL' },
          )
          for (var lj = 0; lj < lastJobs.length; lj++) {
            try {
              var ljEvent = $app.findRecordById(
                'automation_events',
                lastJobs[lj].getString('event'),
              )
              if (
                ljEvent.getString('entity_type') === entityType &&
                ljEvent.getString('entity_id') === entityId
              ) {
                var lastDate = new Date(lastJobs[lj].getString('created'))
                if (new Date(lastDate.getTime() + cooldownMin * 60000) > new Date(now)) {
                  cooldownActive = true
                }
                break
              }
            } catch (_) {}
          }
        } catch (_) {}
        if (cooldownActive) continue
      }

      var maxPerDay = rule.getNumber('max_executions_per_day') || 0
      if (maxPerDay > 0) {
        var todayStart = new Date()
        todayStart.setHours(0, 0, 0, 0)
        try {
          var todayJobs = $app.findRecordsByFilter(
            'automation_jobs',
            'rule = {:rid} && created >= {:ts} && (status = {:s1} || status = {:s2})',
            '-created',
            200,
            0,
            { rid: rule.id, ts: todayStart.toISOString(), s1: 'COMPLETED', s2: 'WAITING_APPROVAL' },
          )
          if (todayJobs.length >= maxPerDay) {
            try {
              var nCol = $app.findCollectionByNameOrId('automation_notifications')
              var nRec = new Record(nCol)
              nRec.set('store', storeId)
              nRec.set('type', 'automation_limit')
              nRec.set('title', 'Automação pausada: limite diário atingido.')
              nRec.set(
                'message',
                'A automacao "' +
                  rule.getString('name') +
                  '" atingiu o limite de ' +
                  maxPerDay +
                  ' execucoes por dia.',
              )
              nRec.set('severity', 'WARNING')
              nRec.set('read', false)
              $app.save(nRec)
            } catch (_) {}
            continue
          }
        } catch (_) {}
      }

      var idempotencyKey =
        storeId +
        ':' +
        rule.id +
        ':' +
        eventRec.id +
        ':' +
        (entityId || '') +
        ':' +
        rule.getString('action_type')
      try {
        var existingJob = $app.findFirstRecordByFilter(
          'automation_jobs',
          'idempotency_key = {:ik} && status = {:st}',
          { ik: idempotencyKey, st: 'COMPLETED' },
        )
        if (existingJob) continue
      } catch (_) {}

      try {
        var dupJob = $app.findFirstRecordByFilter(
          'automation_jobs',
          'rule = {:rid} && event = {:eid}',
          { rid: rule.id, eid: eventRec.id },
        )
        if (dupJob) continue
      } catch (_) {}

      var jobRec = new Record(jobsCol)
      jobRec.set('store', storeId)
      jobRec.set('rule', rule.id)
      jobRec.set('event', eventRec.id)
      jobRec.set('job_type', rule.getString('action_type'))
      jobRec.set('status', 'QUEUED')
      jobRec.set('priority', rule.getNumber('priority') || 5)
      jobRec.set('payload', JSON.stringify(payload))
      jobRec.set('attempts', 0)
      jobRec.set('max_attempts', 3)
      jobRec.set('scheduled_for', now)
      jobRec.set('idempotency_key', idempotencyKey)
      $app.save(jobRec)
      jobsCreated++
    }

    eventRec.set('status', 'PROCESSED')
    eventRec.set('processed_at', new Date().toISOString())
    $app.save(eventRec)

    return e.json(200, { status: 'processed', eventId: eventRec.id, jobsCreated: jobsCreated })
  } catch (err) {
    $app.logger().error('emit_event_core_error', 'error', String(err))
    return e.json(500, { error: 'Erro ao processar evento: ' + String(err) })
  }
})
