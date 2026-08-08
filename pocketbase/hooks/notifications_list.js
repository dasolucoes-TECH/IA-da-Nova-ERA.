routerAdd(
  'GET',
  '/backend/v1/notifications',
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

      var notifs = $app.findRecordsByFilter(
        'automation_notifications',
        'store = {:sid}',
        '-created',
        50,
        0,
        { sid: storeRecord.id },
      )
      var items = []
      var unread = 0
      for (var i = 0; i < notifs.length; i++) {
        var n = notifs[i]
        if (!n.getBool('read')) unread++
        items.push({
          id: n.id,
          type: n.getString('type'),
          title: n.getString('title'),
          message: n.getString('message'),
          severity: n.getString('severity'),
          entity_type: n.getString('entity_type'),
          entity_id: n.getString('entity_id'),
          read: n.getBool('read'),
          created: n.getString('created'),
        })
      }
      return e.json(200, { items: items, unread: unread })
    } catch (err) {
      return e.internalServerError('Erro: ' + String(err))
    }
  },
  $apis.requireAuth(),
)
