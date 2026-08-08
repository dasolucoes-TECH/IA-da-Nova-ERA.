routerAdd(
  'GET',
  '/backend/v1/autopilot/rules',
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

      var rules = $app.findRecordsByFilter(
        'automation_rules',
        'store = {:sid}',
        '-created',
        100,
        0,
        { sid: storeRecord.id },
      )
      var items = []
      for (var i = 0; i < rules.length; i++) {
        var r = rules[i]
        items.push({
          id: r.id,
          name: r.getString('name'),
          description: r.getString('description'),
          enabled: r.getBool('enabled'),
          trigger_type: r.getString('trigger_type'),
          trigger_config: r.getString('trigger_config'),
          conditions: r.getString('conditions'),
          action_type: r.getString('action_type'),
          action_config: r.getString('action_config'),
          autonomy_mode: r.getString('autonomy_mode'),
          priority: r.getNumber('priority'),
          cooldown_minutes: r.getNumber('cooldown_minutes'),
          max_executions_per_day: r.getNumber('max_executions_per_day'),
          last_executed_at: r.getString('last_executed_at'),
          execution_count: r.getNumber('execution_count'),
          created: r.getString('created'),
        })
      }
      return e.json(200, { items: items })
    } catch (err) {
      return e.internalServerError('Erro: ' + String(err))
    }
  },
  $apis.requireAuth(),
)
