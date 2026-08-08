routerAdd(
  'GET',
  '/backend/v1/agents/nova-era-assistant/conversations',
  (e) => {
    try {
      var userId = e.auth ? e.auth.id : ''
      if (!userId) return e.unauthorizedError('Autenticação necessária')

      var limit = parseInt((e.requestInfo().query && e.requestInfo().query.limit) || '20', 10) || 20
      var conversations = $ai
        .agent('nova-era-assistant')
        .listConversations({ user_id: userId, limit: limit })
      return e.json(200, conversations)
    } catch (err) {
      return e.internalServerError('Erro ao listar conversas: ' + String(err))
    }
  },
  $apis.requireAuth(),
)
