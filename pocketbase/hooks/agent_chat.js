routerAdd(
  'POST',
  '/backend/v1/agents/nova-era-assistant/chat',
  (e) => {
    try {
      var userId = e.auth ? e.auth.id : ''
      if (!userId) return e.unauthorizedError('Autenticação necessária')

      var body = e.requestInfo().body || {}
      var message = (body.message || '').trim()
      if (!message) return e.badRequestError('A mensagem é obrigatória')
      if (message.length > 5000)
        return e.badRequestError('Mensagem muito longa (máx 5000 caracteres)')

      var result = $ai.agent('nova-era-assistant').chat({
        user_id: userId,
        conversation_id: body.conversation_id || null,
        message: message,
      })

      var storeRecord = $app.__shopifyGetStore()
      var syncInfo = ''
      if (storeRecord) {
        var lastSync =
          storeRecord.getString('last_product_sync') || storeRecord.getString('last_order_sync')
        if (lastSync) {
          var syncDate = new Date(lastSync)
          var minutesAgo = Math.floor((new Date() - syncDate) / 60000)
          if (minutesAgo < 60) {
            syncInfo = ' [Dados Shopify sincronizados há ' + minutesAgo + ' minutos]'
          } else {
            syncInfo =
              ' [Dados Shopify sincronizados há ' +
              Math.floor(minutesAgo / 60) +
              ' horas — considere sincronizar]'
          }
        } else {
          syncInfo = ' [Dados não sincronizados — sincronize para dados atualizados]'
        }
      }

      var content = result.content
      if (syncInfo && content) {
        content = content + '\n\n_' + syncInfo + '_'
      }

      return e.json(200, {
        conversation_id: result.conversation_id,
        content: content,
        citations: result.citations,
        message_id: result.message_id,
      })
    } catch (err) {
      if (err instanceof SkipAiConfigError)
        return e.json(503, { error: 'IA temporariamente indisponível' })
      if (err instanceof SkipAiAgentsError) {
        var status = err.status || 500
        return e.json(status, { error: status >= 500 ? 'Falha no agente' : err.message })
      }
      return e.internalServerError('Erro no agente: ' + String(err))
    }
  },
  $apis.requireAuth(),
)
