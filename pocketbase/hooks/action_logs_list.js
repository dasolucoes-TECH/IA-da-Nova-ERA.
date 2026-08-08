routerAdd(
  'GET',
  '/backend/v1/action-logs',
  (e) => {
    try {
      var userId = e.auth ? e.auth.id : ''
      if (!userId) return e.unauthorizedError('Auth required')

      var storeRecord = null
      try {
        var stores = $app.findRecordsByFilter('stores', "id != ''", 'created', 1, 0)
        if (stores.length > 0) storeRecord = stores[0]
      } catch (_) {}

      if (!storeRecord) return e.json(200, { items: [] })

      var limit = parseInt((e.requestInfo().query && e.requestInfo().query.limit) || '20', 10) || 20
      var logs = $app.findRecordsByFilter(
        'action_logs',
        "store = '" + storeRecord.id + "'",
        '-created',
        limit,
        0,
      )

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
          created: l.getString('created'),
        })
      }

      return e.json(200, { items: items })
    } catch (err) {
      return e.internalServerError('Error: ' + String(err))
    }
  },
  $apis.requireAuth(),
)
