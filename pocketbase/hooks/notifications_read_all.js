routerAdd(
  'POST',
  '/backend/v1/notifications/read-all',
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

      var unreadNotifs = $app.findRecordsByFilter(
        'automation_notifications',
        'store = {:sid} && read = false',
        '-created',
        200,
        0,
        { sid: storeRecord.id },
      )
      var count = 0
      for (var i = 0; i < unreadNotifs.length; i++) {
        unreadNotifs[i].set('read', true)
        $app.save(unreadNotifs[i])
        count++
      }

      return e.json(200, { success: true, markedRead: count })
    } catch (err) {
      return e.internalServerError('Erro: ' + String(err))
    }
  },
  $apis.requireAuth(),
)
