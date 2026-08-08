routerAdd(
  'GET',
  '/backend/v1/agents/nova-era-assistant/conversations/{conversationId}/messages',
  (e) => {
    try {
      var userId = e.auth ? e.auth.id : ''
      if (!userId) return e.unauthorizedError('Autenticação necessária')

      var conversationId = e.request.pathValue('conversationId')
      var messages = $ai.agent('nova-era-assistant').listMessages({
        conversation_id: conversationId,
        user_id: userId,
      })
      return e.json(200, messages)
    } catch (err) {
      if (err instanceof SkipAiAgentsError) {
        var status = err.status || 500
        return e.json(status, {
          error: status >= 500 ? 'Falha ao carregar mensagens' : err.message,
        })
      }
      return e.internalServerError('Erro ao carregar mensagens: ' + String(err))
    }
  },
  $apis.requireAuth(),
)
