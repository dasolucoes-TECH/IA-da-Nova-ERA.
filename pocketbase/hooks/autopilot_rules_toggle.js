routerAdd(
  'POST',
  '/backend/v1/autopilot/rules/{id}/toggle',
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
      if (memberRole !== 'OWNER' && memberRole !== 'ADMIN')
        return e.json(403, { error: 'Apenas OWNER e ADMIN podem alterar regras' })

      var ruleId = e.request.pathValue('id')
      var rule = $app.findRecordById('automation_rules', ruleId)
      if (rule.getString('store') !== storeRecord.id)
        return e.json(403, { error: 'Regra não pertence à loja' })

      var actionType = rule.getString('action_type')
      var IMPLEMENTED_ACTIONS = [
        'GENERATE_PRODUCT_SEO',
        'GENERATE_INSTAGRAM_CONTENT',
        'CREATE_NOTIFICATION',
        'ANALYZE_LOW_STOCK',
        'ANALYZE_PRODUCT_PERFORMANCE',
        'GENERATE_PRODUCT_CONTENT',
      ]
      if (!rule.getBool('enabled') && IMPLEMENTED_ACTIONS.indexOf(actionType) === -1) {
        return e.badRequestError('Esta ação ainda não está implementada e não pode ser ativada.')
      }

      rule.set('enabled', !rule.getBool('enabled'))
      $app.save(rule)

      return e.json(200, { id: rule.id, enabled: rule.getBool('enabled') })
    } catch (err) {
      return e.internalServerError('Erro: ' + String(err))
    }
  },
  $apis.requireAuth(),
)
