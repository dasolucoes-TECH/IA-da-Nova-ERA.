routerAdd(
  'POST',
  '/backend/v1/agents/nova-era-assistant/chat',
  (e) => {
    try {
      const userId = e.auth?.id
      if (!userId) return e.unauthorizedError('Autenticação necessária')

      const body = e.requestInfo().body || {}
      const message = body.message
      if (!message || !message.trim()) {
        return e.badRequestError('A mensagem é obrigatória')
      }

      const result = $ai.agent('nova-era-assistant').chat({
        user_id: userId,
        conversation_id: body.conversation_id || null,
        message: message.trim(),
      })

      return e.json(200, {
        conversation_id: result.conversation_id,
        content: result.content,
        citations: result.citations,
        message_id: result.message_id,
      })
    } catch (err) {
      return e.internalServerError('Erro no agente: ' + String(err))
    }
  },
  $apis.requireAuth(),
)
