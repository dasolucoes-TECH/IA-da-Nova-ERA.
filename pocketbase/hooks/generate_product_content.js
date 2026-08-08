routerAdd(
  'POST',
  '/backend/v1/products/generate',
  (e) => {
    try {
      var body = e.requestInfo().body || {}
      var name = (body.name || '').trim()
      var currentDescription = (body.currentDescription || '').trim()
      var price = body.price
      var cost = body.cost
      var supplierName = body.supplierName

      if (!name) return e.badRequestError('Nome do produto é obrigatório')
      if (name.length > 200)
        return e.badRequestError('Nome do produto muito longo (máx 200 caracteres)')

      var verifiedFacts = {
        name: name,
        description: currentDescription || null,
        price: price || null,
        cost: cost || null,
        vendor: supplierName || null,
        specifications_verified: [],
        shipping_policy: null,
        warranty_verified: null,
        product_url: null,
      }

      var prompt =
        'Você é um copywriter especialista em e-commerce. Gere conteúdo de alta conversão em Português (Brasil) para o produto abaixo.\n\n'
      prompt +=
        'FATOS VERIFICADOS (use EXCLUSIVAMENTE estes dados — NÃO invente material, garantia, certificação, autonomia, capacidade, compatibilidade, frete grátis, prazo de entrega, desconto, prova social, quantidade vendida ou avaliações):\n'
      prompt += JSON.stringify(verifiedFacts, null, 2) + '\n\n'
      prompt += 'Responda ESTRITAMENTE em JSON válido (sem markdown):\n'
      prompt += '{\n'
      prompt += '  "description": "descrição comercial baseada apenas nos fatos fornecidos",\n'
      prompt += '  "seo_title": "título SEO até 60 caracteres",\n'
      prompt += '  "meta_description": "meta descrição até 155 caracteres",\n'
      prompt += '  "keywords": "palavra-chave 1, palavra-chave 2",\n'
      prompt += '  "slug": "slug-amigavel",\n'
      prompt += '  "alt_text": "texto alternativo descritivo",\n'
      prompt += '  "faq": [{"question": "Dúvida?", "answer": "Resposta baseada nos fatos"}],\n'
      prompt += '  "benefits": ["Benefício baseado nos fatos"],\n'
      prompt += '  "specifications": [],\n'
      prompt += '  "instagram_caption": "Legenda sem claims inventadas",\n'
      prompt += '  "instagram_hashtags": "#hashtag1 #hashtag2",\n'
      prompt += '  "stories": "Roteiro de stories",\n'
      prompt += '  "email_marketing": "E-mail marketing sem claims inventadas"\n'
      prompt += '}'

      var aiReply = $ai.chat({
        model: 'reasoning',
        messages: [
          {
            role: 'system',
            content:
              'Você responde apenas em JSON válido. Não use markdown. Não invente especificações, garantias, prazos ou benefícios não fornecidos.',
          },
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
      } catch (parseErr) {
        var repairReply = $ai.chat({
          model: 'fast',
          messages: [
            {
              role: 'system',
              content: 'Corrija o JSON abaixo para ser válido. Retorne apenas JSON.',
            },
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

      var requiredFields = ['description', 'seo_title', 'meta_description', 'keywords', 'slug']
      for (var i = 0; i < requiredFields.length; i++) {
        if (!data[requiredFields[i]] || typeof data[requiredFields[i]] !== 'string') {
          return e.json(422, {
            error: 'Resposta da IA incompleta. Campo faltante: ' + requiredFields[i],
          })
        }
      }

      return e.json(200, data)
    } catch (err) {
      return e.internalServerError('Falha ao gerar conteúdo: ' + String(err))
    }
  },
  $apis.requireAuth(),
)
