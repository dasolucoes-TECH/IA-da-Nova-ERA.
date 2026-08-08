routerAdd(
  'POST',
  '/backend/v1/content/instagram',
  (e) => {
    try {
      var body = e.requestInfo().body || {}
      var productName = (body.productName || '').trim()
      var price = body.price
      var description = (body.description || '').trim()

      if (!productName) return e.badRequestError('productName é obrigatório')
      if (productName.length > 200) return e.badRequestError('productName muito longo')

      var brandProfile = {
        brand_name: 'Nova Era',
        slogan: 'Tecnologia que transforma',
        instagram: '@nvera.store',
        tone: 'moderno, tecnológico, descontraído',
        emoji_style: 'moderado',
        visual_style: 'navy + amarelo',
        audience: 'consumidor de tecnologia no Brasil',
      }

      var verifiedFacts = {
        name: productName,
        price: price || null,
        description: description || null,
        benefits: [],
        category: null,
        shipping_policy: null,
      }

      var prompt =
        'Crie conteúdo de Instagram para o produto abaixo. Use apenas os fatos fornecidos — NÃO invente frete grátis, desconto, garantia, material, especificações ou prova social.\n\n'
      prompt += 'FATOS:\n' + JSON.stringify(verifiedFacts, null, 2) + '\n\n'
      prompt += 'PERFIL DA MARCA:\n' + JSON.stringify(brandProfile, null, 2) + '\n\n'
      prompt += 'Responda em JSON válido (sem markdown):\n'
      prompt +=
        '{"caption":"legenda","hashtags":"#tags","stories":["tela1","tela2","tela3"],"carousel":["slide1","slide2"],"reels_script":"roteiro","cta":"call to action"}'

      var aiReply = $ai.chat({
        model: 'fast',
        messages: [
          { role: 'system', content: 'Responda apenas em JSON válido. Não invente claims.' },
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
            { role: 'system', content: 'Corrija o JSON. Retorne apenas JSON válido.' },
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
      return e.internalServerError('Erro ao gerar conteúdo: ' + String(err))
    }
  },
  $apis.requireAuth(),
)
