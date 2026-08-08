migrate(
  (app) => {
    var jobsCol = app.findCollectionByNameOrId('automation_jobs')
    if (!jobsCol.fields.getByName('idempotency_key')) {
      jobsCol.fields.add(new TextField({ name: 'idempotency_key' }))
    }
    jobsCol.addIndex(
      'idx_automation_jobs_idempotency',
      true,
      'idempotency_key',
      "idempotency_key != ''",
    )
    app.save(jobsCol)

    var lockCollections = [
      'automation_rules',
      'automation_events',
      'automation_jobs',
      'automation_approvals',
      'automation_notifications',
      'action_logs',
      'integration_syncs',
    ]
    for (var i = 0; i < lockCollections.length; i++) {
      var col = app.findCollectionByNameOrId(lockCollections[i])
      col.listRule = null
      col.viewRule = null
      col.createRule = null
      col.updateRule = null
      col.deleteRule = null
      app.save(col)
    }
  },
  (app) => {
    var jobsCol = app.findCollectionByNameOrId('automation_jobs')
    try {
      jobsCol.removeIndex('idx_automation_jobs_idempotency')
    } catch (_) {}
    var f = jobsCol.fields.getByName('idempotency_key')
    if (f) jobsCol.fields.remove(f)
    app.save(jobsCol)

    var unlockCollections = [
      'automation_rules',
      'automation_events',
      'automation_jobs',
      'automation_approvals',
      'automation_notifications',
      'action_logs',
      'integration_syncs',
    ]
    for (var i = 0; i < unlockCollections.length; i++) {
      var col = app.findCollectionByNameOrId(unlockCollections[i])
      col.listRule = "@request.auth.id != ''"
      col.viewRule = "@request.auth.id != ''"
      col.createRule = "@request.auth.id != ''"
      col.updateRule = "@request.auth.id != ''"
      col.deleteRule = "@request.auth.id != ''"
      app.save(col)
    }
  },
)
