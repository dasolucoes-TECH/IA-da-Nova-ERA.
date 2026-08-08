routerAdd(
  'POST',
  '/backend/v1/notifications/{id}/read',
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

      var notifId = e.request.pathValue('id')
      var notif = $app.findRecordById('automation_notifications', notifId)
      if (notif.getString('store') !== storeRecord.id)
        return e.json(403, { error: 'Notificação não pertence à loja' })

      notif.set('read', true)
      $app.save(notif)

      return e.json(200, { success: true })
    } catch (err) {
      return e.internalServerError('Erro: ' + String(err))
    }
  },
  $apis.requireAuth(),
)
