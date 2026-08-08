routerAdd(
  'POST',
  '/backend/v1/agents/nova-era-assistant/chat-stream',
  (e) => {
    try {
      var userId = e.auth ? e.auth.id : ''
      if (!userId) return e.unauthorizedError('Autenticação necessária')

      var body = e.requestInfo().body || {}
      var message = (body.message || '').trim()
      if (!message) return e.badRequestError('A mensagem é obrigatória')
      if (message.length > 5000) return e.badRequestError('Mensagem muito longa')

      var conv = $ai.agent('nova-era-assistant').getOrCreateConversation({
        user_id: userId,
        id: body.conversation_id || null,
      })

      var iter = $ai.agent('nova-era-assistant').chat({
        user_id: userId,
        conversation_id: conv.id,
        message: message,
        stream: true,
      })

      e.response.header().set('Content-Type', 'text/event-stream')
      e.response.header().set('Cache-Control', 'no-cache')
      e.response.header().set('X-Conversation-Id', conv.id)
      $response.stream(e, iter)
    } catch (err) {
      if (err instanceof SkipAiConfigError)
        return e.json(503, { error: 'IA temporariamente indisponível' })
      return e.internalServerError('Erro no streaming: ' + String(err))
    }
  },
  $apis.requireAuth(),
)
