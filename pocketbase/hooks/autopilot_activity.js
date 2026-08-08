routerAdd(
  'GET',
  '/backend/v1/autopilot/activity',
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

      var source =
        e.requestInfo().query && e.requestInfo().query.source ? e.requestInfo().query.source : ''
      var statusFilter =
        e.requestInfo().query && e.requestInfo().query.status ? e.requestInfo().query.status : ''

      var filter = 'store = {:sid}'
      var params = { sid: storeRecord.id }
      if (statusFilter) {
        filter += ' && status = {:st}'
        params.st = statusFilter
      }
      if (source === 'AI') {
        filter += ' && automation = true'
      } else if (source === 'SHOPIFY') {
        filter += " && execution_source = 'SHOPIFY_WEBHOOK'"
      }

      var logs = $app.findRecordsByFilter('action_logs', filter, '-created', 50, 0, params)
      var items = []
      for (var i = 0; i < logs.length; i++) {
        var l = logs[i]
        items.push({
          id: l.id,
          action_type: l.getString('action_type'),
          entity_type: l.getString('entity_type'),
          entity_id: l.getString('entity_id'),
          status: l.getString('status'),
          summary: l.getString('summary'),
          execution_source: l.getString('execution_source'),
          estimated_minutes_saved: l.getNumber('estimated_minutes_saved'),
          automation: l.getBool('automation'),
          rule: l.getString('rule'),
          created: l.getString('created'),
        })
      }
      return e.json(200, { items: items })
    } catch (err) {
      return e.internalServerError('Erro: ' + String(err))
    }
  },
  $apis.requireAuth(),
)
