migrate(
  (app) => {
    var storesId = app.findCollectionByNameOrId('stores').id
    var usersId = '_pb_users_auth_'
    var actionLogsId = app.findCollectionByNameOrId('action_logs').id

    var storesCol = app.findCollectionByNameOrId('stores')
    if (!storesCol.fields.getByName('autopilot_enabled')) {
      storesCol.fields.add(new BoolField({ name: 'autopilot_enabled' }))
    }
    app.save(storesCol)

    var alCol = app.findCollectionByNameOrId('action_logs')
    if (!alCol.fields.getByName('execution_source')) {
      alCol.fields.add(
        new SelectField({
          name: 'execution_source',
          values: ['USER', 'AUTOMATION', 'AI', 'SHOPIFY_WEBHOOK', 'SYSTEM'],
          maxSelect: 1,
        }),
      )
    }
    if (!alCol.fields.getByName('estimated_minutes_saved')) {
      alCol.fields.add(new NumberField({ name: 'estimated_minutes_saved' }))
    }
    if (!alCol.fields.getByName('rule')) {
      alCol.fields.add(new TextField({ name: 'rule' }))
    }
    if (!alCol.fields.getByName('event')) {
      alCol.fields.add(new TextField({ name: 'event' }))
    }
    if (!alCol.fields.getByName('job')) {
      alCol.fields.add(new TextField({ name: 'job' }))
    }
    if (!alCol.fields.getByName('automation')) {
      alCol.fields.add(new BoolField({ name: 'automation' }))
    }
    app.save(alCol)

    var rulesCol = new Collection({
      name: 'automation_rules',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'store',
          type: 'relation',
          collectionId: storesId,
          required: true,
          maxSelect: 1,
          cascadeDelete: true,
        },
        { name: 'name', type: 'text', required: true },
        { name: 'description', type: 'text' },
        { name: 'enabled', type: 'bool' },
        { name: 'trigger_type', type: 'text', required: true },
        { name: 'trigger_config', type: 'json' },
        { name: 'conditions', type: 'json' },
        { name: 'action_type', type: 'text', required: true },
        { name: 'action_config', type: 'json' },
        {
          name: 'autonomy_mode',
          type: 'select',
          values: ['SUGGEST', 'APPROVAL', 'AUTOPILOT'],
          maxSelect: 1,
          required: true,
        },
        { name: 'priority', type: 'number' },
        { name: 'cooldown_minutes', type: 'number' },
        { name: 'max_executions_per_day', type: 'number' },
        { name: 'last_executed_at', type: 'date' },
        { name: 'execution_count', type: 'number' },
        { name: 'created_by', type: 'relation', collectionId: usersId, maxSelect: 1 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_automation_rules_store ON automation_rules (store)',
        'CREATE INDEX idx_automation_rules_enabled ON automation_rules (enabled)',
        'CREATE INDEX idx_automation_rules_trigger ON automation_rules (trigger_type)',
      ],
    })
    app.save(rulesCol)
    var rulesId = app.findCollectionByNameOrId('automation_rules').id

    var eventsCol = new Collection({
      name: 'automation_events',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'store',
          type: 'relation',
          collectionId: storesId,
          required: true,
          maxSelect: 1,
          cascadeDelete: true,
        },
        { name: 'event_type', type: 'text', required: true },
        { name: 'source', type: 'text' },
        { name: 'entity_type', type: 'text' },
        { name: 'entity_id', type: 'text' },
        { name: 'payload', type: 'json' },
        { name: 'deduplication_key', type: 'text' },
        {
          name: 'status',
          type: 'select',
          values: ['PENDING', 'PROCESSING', 'PROCESSED', 'FAILED', 'IGNORED'],
          maxSelect: 1,
        },
        { name: 'received_at', type: 'date' },
        { name: 'processed_at', type: 'date' },
        { name: 'error', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        "CREATE UNIQUE INDEX idx_automation_events_dedup ON automation_events (deduplication_key) WHERE deduplication_key != ''",
        'CREATE INDEX idx_automation_events_status ON automation_events (status)',
        'CREATE INDEX idx_automation_events_store ON automation_events (store)',
        'CREATE INDEX idx_automation_events_type ON automation_events (event_type)',
      ],
    })
    app.save(eventsCol)
    var eventsId = app.findCollectionByNameOrId('automation_events').id

    var jobsCol = new Collection({
      name: 'automation_jobs',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'store',
          type: 'relation',
          collectionId: storesId,
          required: true,
          maxSelect: 1,
          cascadeDelete: true,
        },
        {
          name: 'rule',
          type: 'relation',
          collectionId: rulesId,
          required: true,
          maxSelect: 1,
          cascadeDelete: true,
        },
        {
          name: 'event',
          type: 'relation',
          collectionId: eventsId,
          required: true,
          maxSelect: 1,
          cascadeDelete: true,
        },
        { name: 'job_type', type: 'text' },
        {
          name: 'status',
          type: 'select',
          values: [
            'QUEUED',
            'RUNNING',
            'WAITING_APPROVAL',
            'COMPLETED',
            'FAILED',
            'CANCELLED',
            'RETRYING',
          ],
          maxSelect: 1,
        },
        { name: 'priority', type: 'number' },
        { name: 'payload', type: 'json' },
        { name: 'attempts', type: 'number' },
        { name: 'max_attempts', type: 'number' },
        { name: 'scheduled_for', type: 'date' },
        { name: 'started_at', type: 'date' },
        { name: 'completed_at', type: 'date' },
        { name: 'error', type: 'text' },
        { name: 'result', type: 'json' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_automation_jobs_status ON automation_jobs (status)',
        'CREATE INDEX idx_automation_jobs_scheduled ON automation_jobs (scheduled_for)',
        'CREATE INDEX idx_automation_jobs_store ON automation_jobs (store)',
        'CREATE INDEX idx_automation_jobs_rule ON automation_jobs (rule)',
      ],
    })
    app.save(jobsCol)
    var jobsId = app.findCollectionByNameOrId('automation_jobs').id

    var approvalsCol = new Collection({
      name: 'automation_approvals',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'store',
          type: 'relation',
          collectionId: storesId,
          required: true,
          maxSelect: 1,
          cascadeDelete: true,
        },
        { name: 'rule', type: 'relation', collectionId: rulesId, maxSelect: 1 },
        { name: 'job', type: 'relation', collectionId: jobsId, maxSelect: 1 },
        { name: 'action_log', type: 'relation', collectionId: actionLogsId, maxSelect: 1 },
        { name: 'requested_by', type: 'relation', collectionId: usersId, maxSelect: 1 },
        { name: 'approved_by', type: 'relation', collectionId: usersId, maxSelect: 1 },
        { name: 'title', type: 'text' },
        { name: 'description', type: 'text' },
        { name: 'entity_type', type: 'text' },
        { name: 'entity_id', type: 'text' },
        { name: 'proposed_action', type: 'json' },
        {
          name: 'risk_level',
          type: 'select',
          values: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
          maxSelect: 1,
        },
        {
          name: 'status',
          type: 'select',
          values: ['PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED'],
          maxSelect: 1,
        },
        { name: 'expires_at', type: 'date' },
        { name: 'approved_at', type: 'date' },
        { name: 'rejected_at', type: 'date' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_automation_approvals_status ON automation_approvals (status)',
        'CREATE INDEX idx_automation_approvals_store ON automation_approvals (store)',
      ],
    })
    app.save(approvalsCol)

    var notifsCol = new Collection({
      name: 'automation_notifications',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'store',
          type: 'relation',
          collectionId: storesId,
          required: true,
          maxSelect: 1,
          cascadeDelete: true,
        },
        { name: 'user', type: 'relation', collectionId: usersId, maxSelect: 1 },
        { name: 'type', type: 'text' },
        { name: 'title', type: 'text' },
        { name: 'message', type: 'text' },
        {
          name: 'severity',
          type: 'select',
          values: ['INFO', 'SUCCESS', 'WARNING', 'ERROR', 'CRITICAL'],
          maxSelect: 1,
        },
        { name: 'entity_type', type: 'text' },
        { name: 'entity_id', type: 'text' },
        { name: 'read', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_automation_notifications_user ON automation_notifications (user)',
        'CREATE INDEX idx_automation_notifications_read ON automation_notifications (read)',
        'CREATE INDEX idx_automation_notifications_store ON automation_notifications (store)',
      ],
    })
    app.save(notifsCol)
  },
  (app) => {
    var names = [
      'automation_notifications',
      'automation_approvals',
      'automation_jobs',
      'automation_events',
      'automation_rules',
    ]
    for (var i = 0; i < names.length; i++) {
      try {
        app.delete(app.findCollectionByNameOrId(names[i]))
      } catch (_) {}
    }
    try {
      var alCol = app.findCollectionByNameOrId('action_logs')
      var fields = [
        'execution_source',
        'estimated_minutes_saved',
        'rule',
        'event',
        'job',
        'automation',
      ]
      for (var j = 0; j < fields.length; j++) {
        var f = alCol.fields.getByName(fields[j])
        if (f) alCol.fields.remove(f)
      }
      app.save(alCol)
    } catch (_) {}
    try {
      var storesCol = app.findCollectionByNameOrId('stores')
      var af = storesCol.fields.getByName('autopilot_enabled')
      if (af) storesCol.fields.remove(af)
      app.save(storesCol)
    } catch (_) {}
  },
)
