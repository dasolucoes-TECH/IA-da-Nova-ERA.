routerAdd(
  'POST',
  '/backend/v1/content/seo',
  (e) => {
    try {
      var body = e.requestInfo().body || {}
      var productName = (body.productName || '').trim()
      var productDescription = (body.productDescription || '').trim()

      if (!productName) return e.badRequestError('productName é obrigatório')
      if (productName.length > 200) return e.badRequestError('productName muito longo')

      var prompt =
        'Gere dados SEO para e-commerce do produto "' +
        productName +
        '". Descrição: ' +
        (productDescription || 'N/A') +
        '.\n'
      prompt += 'NÃO invente especificações ou claims. Use apenas os fatos fornecidos.\n'
      prompt += 'Responda em JSON válido (sem markdown):\n'
      prompt +=
        '{"seo_title":"título SEO máx 60 chars","meta_description":"meta descrição máx 155 chars","keywords":"termo1, termo2","alt_text":"descrição da imagem","slug":"slug-url","schema":{"@context":"https://schema.org/","@type":"Product","name":"' +
        productName +
        '"}}'

      var aiReply = $ai.chat({
        model: 'fast',
        messages: [
          { role: 'system', content: 'Responda exclusivamente com JSON válido.' },
          { role: 'user', content: prompt },
        ],
      })

      var text = aiReply.choices[0].message.content.trim()
      if (text.startsWith('```json'))
        text = text
          .replace(/^```json\s*/, '')
          .replace(/```$/, '')
          .trim()
      if (text.startsWith('```'))
        text = text
          .replace(/^```\s*/, '')
          .replace(/```$/, '')
          .trim()

      var data
      try {
        data = JSON.parse(text)
      } catch (_) {
        var repairReply = $ai.chat({
          model: 'fast',
          messages: [
            { role: 'system', content: 'Corrija o JSON. Retorne apenas JSON.' },
            { role: 'user', content: text },
          ],
        })
        var repairedText = repairReply.choices[0].message.content.trim()
        if (repairedText.startsWith('```json'))
          repairedText = repairedText
            .replace(/^```json\s*/, '')
            .replace(/```$/, '')
            .trim()
        if (repairedText.startsWith('```'))
          repairedText = repairedText
            .replace(/^```\s*/, '')
            .replace(/```$/, '')
            .trim()
        try {
          data = JSON.parse(repairedText)
        } catch (_) {
          return e.json(422, { error: 'A IA retornou um formato inválido. Tente novamente.' })
        }
      }

      return e.json(200, data)
    } catch (err) {
      return e.internalServerError('Erro ao gerar SEO: ' + String(err))
    }
  },
  $apis.requireAuth(),
)
