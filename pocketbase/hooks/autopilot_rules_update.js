routerAdd(
  'PATCH',
  '/backend/v1/autopilot/rules/{id}',
  (e) => {
    try {
      var userId = e.auth ? e.auth.id : ''
      if (!userId) return e.unauthorizedError('Autenticação necessária')

      var storeRecord = null
      var memberRole = ''
      try {
        var members = $app.findRecordsByFilter('store_members', 'user = {:uid}', '-created', 1, 0, {
          uid: userId,
        })
        if (members.length > 0) {
          memberRole = members[0].getString('role')
          storeRecord = $app.findRecordById('stores', members[0].getString('store'))
        }
      } catch (_) {}
      if (!storeRecord) return e.json(403, { error: 'Nenhuma loja associada' })
      if (memberRole === 'VIEWER' || memberRole === 'EDITOR')
        return e.json(403, { error: 'Permissão insuficiente' })

      var ruleId = e.request.pathValue('id')
      var rule = $app.findRecordById('automation_rules', ruleId)
      if (rule.getString('store') !== storeRecord.id)
        return e.json(403, { error: 'Regra não pertence à loja' })

      var body = e.requestInfo().body || {}
      if (body.name !== undefined) rule.set('name', body.name)
      if (body.description !== undefined) rule.set('description', body.description)
      if (body.trigger_type !== undefined) rule.set('trigger_type', body.trigger_type)
      if (body.trigger_config !== undefined)
        rule.set('trigger_config', JSON.stringify(body.trigger_config))
      if (body.conditions !== undefined) rule.set('conditions', JSON.stringify(body.conditions))
      if (body.action_type !== undefined) rule.set('action_type', body.action_type)
      if (body.action_config !== undefined)
        rule.set('action_config', JSON.stringify(body.action_config))
      if (body.autonomy_mode !== undefined) rule.set('autonomy_mode', body.autonomy_mode)
      if (body.priority !== undefined) rule.set('priority', body.priority)
      if (body.cooldown_minutes !== undefined) rule.set('cooldown_minutes', body.cooldown_minutes)
      if (body.max_executions_per_day !== undefined)
        rule.set('max_executions_per_day', body.max_executions_per_day)
      $app.save(rule)

      return e.json(200, { success: true })
    } catch (err) {
      return e.internalServerError('Erro: ' + String(err))
    }
  },
  $apis.requireAuth(),
)
