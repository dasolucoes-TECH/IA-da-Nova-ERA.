routerAdd(
  'POST',
  '/backend/v1/autopilot/rules',
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
        return e.json(403, { error: 'Apenas OWNER e ADMIN podem criar regras' })

      var body = e.requestInfo().body || {}
      if (!body.name || !body.trigger_type || !body.action_type || !body.autonomy_mode) {
        return e.badRequestError('name, trigger_type, action_type, autonomy_mode são obrigatórios')
      }

      var UNSAFE_ACTIONS = [
        'REQUEST_PRICE_CHANGE',
        'REQUEST_SHOPIFY_ACTIVATION',
        'DELETE_PRODUCT',
        'DELETE_ORDER',
        'PUBLISH_ACTIVE',
        'CANCEL_ORDER',
        'REFUND_ORDER',
        'CHANGE_PRICE',
        'CHANGE_STOCK',
      ]
      if (body.autonomy_mode === 'AUTOPILOT' && UNSAFE_ACTIONS.indexOf(body.action_type) !== -1) {
        return e.badRequestError('Por segurança, esta ação não pode usar AUTOPILOT. Use APPROVAL.')
      }

      var IMPLEMENTED_ACTIONS = [
        'GENERATE_PRODUCT_SEO',
        'GENERATE_INSTAGRAM_CONTENT',
        'CREATE_NOTIFICATION',
        'ANALYZE_LOW_STOCK',
        'ANALYZE_PRODUCT_PERFORMANCE',
        'GENERATE_PRODUCT_CONTENT',
      ]
      if (IMPLEMENTED_ACTIONS.indexOf(body.action_type) === -1) {
        return e.badRequestError('Esta ação ainda não está implementada e não pode ser utilizada.')
      }

      var rulesCol = $app.findCollectionByNameOrId('automation_rules')
      var rec = new Record(rulesCol)
      rec.set('store', storeRecord.id)
      rec.set('name', body.name)
      rec.set('description', body.description || '')
      rec.set('enabled', false)
      rec.set('trigger_type', body.trigger_type)
      rec.set('trigger_config', JSON.stringify(body.trigger_config || {}))
      rec.set('conditions', JSON.stringify(body.conditions || {}))
      rec.set('action_type', body.action_type)
      rec.set('action_config', JSON.stringify(body.action_config || {}))
      rec.set('autonomy_mode', body.autonomy_mode)
      rec.set('priority', body.priority || 5)
      rec.set('cooldown_minutes', body.cooldown_minutes || 0)
      rec.set('max_executions_per_day', body.max_executions_per_day || 50)
      rec.set('execution_count', 0)
      rec.set('created_by', userId)
      $app.save(rec)

      return e.json(200, { id: rec.id, success: true })
    } catch (err) {
      return e.internalServerError('Erro: ' + String(err))
    }
  },
  $apis.requireAuth(),
)
