routerAdd(
  'POST',
  '/backend/v1/autopilot/emit-event',
  (e) => {
    try {
      var userId = e.auth ? e.auth.id : ''
      if (!userId) return e.unauthorizedError('Autenticacao necessaria')

      var storeRecord = null
      try {
        var members = $app.findRecordsByFilter('store_members', 'user = {:uid}', '-created', 1, 0, {
          uid: userId,
        })
        if (members.length > 0)
          storeRecord = $app.findRecordById('stores', members[0].getString('store'))
      } catch (_) {}
      if (!storeRecord) return e.json(403, { error: 'Nenhuma loja associada' })

      var body = e.requestInfo().body || {}
      var eventType = (body.eventType || '').trim()
      if (!eventType) return e.badRequestError('eventType e obrigatorio')

      var dedupKey = body.deduplicationKey
      if (!dedupKey) {
        if (eventType === 'USER_ACTION_REQUESTED') {
          dedupKey = 'manual:' + $security.randomString(16)
        } else {
          dedupKey =
            'manual:' +
            (body.source || 'api') +
            ':' +
            eventType +
            ':' +
            (body.entityId || '') +
            ':' +
            $security.randomString(8)
        }
      }

      var baseUrl = $secrets.get('PB_INSTANCE_URL') || ''
      var internalSecret = $secrets.get('PB_SUPERUSER_TOKEN') || ''
      var res = $http.send({
        url: baseUrl + '/backend/v1/autopilot/emit-event-core',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Internal-Secret': internalSecret },
        body: JSON.stringify({
          storeId: storeRecord.id,
          eventType: eventType,
          source: body.source || 'api',
          entityType: body.entityType || '',
          entityId: body.entityId || '',
          payload: body.payload || {},
          deduplicationKey: dedupKey,
        }),
        timeout: 30,
      })

      if (res.statusCode === 200 && res.json) return e.json(200, res.json)
      return e.json(500, { error: 'Falha ao processar evento' })
    } catch (err) {
      $app.logger().error('autopilot_emit_event_error', 'error', String(err))
      return e.json(500, { error: 'Erro ao processar evento: ' + String(err) })
    }
  },
  $apis.requireAuth(),
)
