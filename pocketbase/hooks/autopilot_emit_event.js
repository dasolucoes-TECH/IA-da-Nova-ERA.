routerAdd(
  'POST',
  '/backend/v1/autopilot/emit-event',
  (e) => {
    try {
      var userId = e.auth ? e.auth.id : ''
      if (!userId) return e.unauthorizedError('Autenticação necessária')

      var storeRecord = null
      try {
        var members = $app.findRecordsByFilter('store_members', 'user = {:uid}', '-created', 1, 0, {
          uid: userId,
        })
        if (members.length > 0) {
          storeRecord = $app.findRecordById('stores', members[0].getString('store'))
        }
      } catch (_) {}
      if (!storeRecord) return e.json(403, { error: 'Nenhuma loja associada' })

      var body = e.requestInfo().body || {}
      var eventType = (body.eventType || '').trim()
      if (!eventType) return e.badRequestError('eventType é obrigatório')

      var dedupKey =
        body.deduplicationKey ||
        (body.source || 'api') + ':' + eventType + ':' + (body.entityId || '')
      var now = new Date().toISOString()

      try {
        var existing = $app.findFirstRecordByFilter(
          'automation_events',
          'deduplication_key = {:dk}',
          { dk: dedupKey },
        )
        if (existing) {
          existing.set('status', 'IGNORED')
          $app.save(existing)
          $app.logger().info('automation_event_deduplicated', 'dedupKey', dedupKey)
          return e.json(200, { status: 'duplicated', eventId: existing.id })
        }
      } catch (_) {}

      var eventsCol = $app.findCollectionByNameOrId('automation_events')
      var eventRec = new Record(eventsCol)
      eventRec.set('store', storeRecord.id)
      eventRec.set('event_type', eventType)
      eventRec.set('source', body.source || 'api')
      eventRec.set('entity_type', body.entityType || '')
      eventRec.set('entity_id', body.entityId || '')
      eventRec.set('payload', JSON.stringify(body.payload || {}))
      eventRec.set('deduplication_key', dedupKey)
      eventRec.set('status', 'PENDING')
      eventRec.set('received_at', now)
      $app.save(eventRec)
      $app.logger().info('automation_event_created', 'eventType', eventType, 'eventId', eventRec.id)

      var rules = []
      try {
        rules = $app.findRecordsByFilter(
          'automation_rules',
          'store = {:sid} && enabled = true && trigger_type = {:tt}',
          '-priority',
          50,
          0,
          { sid: storeRecord.id, tt: eventType },
        )
      } catch (_) {}

      var jobsCreated = 0

      function getNestedValue(obj, path) {
        var parts = path.split('.')
        var current = obj
        for (var i = 0; i < parts.length; i++) {
          if (current === null || current === undefined) return undefined
          current = current[parts[i]]
        }
        return current
      }

      function evaluateCondition(cond, payload) {
        if (!cond || !cond.field) return true
        var val = getNestedValue(payload, cond.field)
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

      function evaluateConditions(conditions, payload) {
        if (!conditions) return true
        if (conditions.all) {
          for (var i = 0; i < conditions.all.length; i++) {
            if (!evaluateCondition(conditions.all[i], payload)) return false
          }
          return true
        }
        if (conditions.any) {
          for (var j = 0; j < conditions.any.length; j++) {
            if (evaluateCondition(conditions.any[j], payload)) return true
          }
          return false
        }
        return evaluateCondition(conditions, payload)
      }

      var jobsCol = $app.findCollectionByNameOrId('automation_jobs')

      for (var r = 0; r < rules.length; r++) {
        var rule = rules[r]
        var conditionsStr = rule.getString('conditions')
        var conditions = null
        try {
          conditions = JSON.parse(conditionsStr)
        } catch (_) {}

        var payload = body.payload || {}
        if (!evaluateConditions(conditions, payload)) continue

        var lastExec = rule.getString('last_executed_at')
        var cooldownMin = rule.getNumber('cooldown_minutes') || 0
        if (lastExec && cooldownMin > 0) {
          var lastDate = new Date(lastExec)
          var cooldownEnd = new Date(lastDate.getTime() + cooldownMin * 60000)
          if (now && new Date(now) < cooldownEnd) {
            $app.logger().info('automation_rule_cooldown_skip', 'ruleId', rule.id)
            continue
          }
        }

        var maxPerDay = rule.getNumber('max_executions_per_day') || 0
        if (maxPerDay > 0) {
          var execCount = rule.getNumber('execution_count') || 0
          var todayStart = new Date()
          todayStart.setHours(0, 0, 0, 0)
          var todayJobs = $app.findRecordsByFilter(
            'automation_jobs',
            'rule = {:rid} && created >= {:ts}',
            '-created',
            100,
            0,
            { rid: rule.id, ts: todayStart.toISOString() },
          )
          if (todayJobs.length >= maxPerDay) {
            var notifCol = $app.findCollectionByNameOrId('automation_notifications')
            var notifRec = new Record(notifCol)
            notifRec.set('store', storeRecord.id)
            notifRec.set('user', userId)
            notifRec.set('type', 'automation_limit')
            notifRec.set('title', 'Automação pausada: limite diário atingido')
            notifRec.set(
              'message',
              'A automação "' +
                rule.getString('name') +
                '" atingiu o limite de ' +
                maxPerDay +
                ' execuções por dia.',
            )
            notifRec.set('severity', 'WARNING')
            notifRec.set('read', false)
            $app.save(notifRec)
            continue
          }
        }

        var idempotencyKey =
          rule.id +
          ':' +
          eventRec.id +
          ':' +
          (body.entityId || '') +
          ':' +
          rule.getString('action_type')
        var existingJob = null
        try {
          existingJob = $app.findFirstRecordByFilter(
            'automation_jobs',
            'rule = {:rid} && event = {:eid}',
            { rid: rule.id, eid: eventRec.id },
          )
        } catch (_) {}
        if (existingJob) continue

        var jobRec = new Record(jobsCol)
        jobRec.set('store', storeRecord.id)
        jobRec.set('rule', rule.id)
        jobRec.set('event', eventRec.id)
        jobRec.set('job_type', rule.getString('action_type'))
        jobRec.set('status', 'QUEUED')
        jobRec.set('priority', rule.getNumber('priority') || 5)
        jobRec.set('payload', JSON.stringify(payload))
        jobRec.set('attempts', 0)
        jobRec.set('max_attempts', 3)
        jobRec.set('scheduled_for', now)
        $app.save(jobRec)
        jobsCreated++
        $app
          .logger()
          .info(
            'automation_job_created',
            'ruleId',
            rule.id,
            'jobId',
            jobRec.id,
            'actionType',
            rule.getString('action_type'),
          )
      }

      eventRec.set('status', 'PROCESSED')
      eventRec.set('processed_at', new Date().toISOString())
      $app.save(eventRec)

      return e.json(200, { status: 'processed', eventId: eventRec.id, jobsCreated: jobsCreated })
    } catch (err) {
      $app.logger().error('autopilot_emit_event_error', 'error', String(err))
      return e.json(500, { error: 'Erro ao processar evento: ' + String(err) })
    }
  },
  $apis.requireAuth(),
)
