routerAdd(
  'POST',
  '/backend/v1/content/instagram',
  (e) => {
    const body = e.requestInfo().body || {}
    const { productName, price } = body

    if (!productName) {
      return e.badRequestError('productName é obrigatório')
    }

    const prompt = `Crie o kit de marketing de Instagram para o produto "${productName}" (Preço: R$ ${price || 0}).
Responda ESTRITAMENTE em formato JSON:
{
  "caption": "Legenda engajadora para o Feed com gatilhos mentais, emojis e CTA de compra",
  "hashtags": "#produto #loja #promocao #compreagora #tendencia",
  "stories": ["Tela 1: Atenção/Problema", "Tela 2: Solução/Benefício do produto", "Tela 3: Oferta especial + Link na Bio"],
  "carousel": ["Slide 1: Capa Chamativa", "Slide 2: Benefício 1 em destaque", "Slide 3: Prova social / Garantia", "Slide 4: Garanta o seu agora"],
  "reels_script": "Cena 1 (0-3s): Gancho visual\nCena 2 (3-10s): Demonstrando o produto em uso\nCena 3 (10-15s): Preço especial + CTA para direct",
  "cta": "Clique no link da bio para garantir o seu com Frete Grátis!"
}`

    try {
      const aiReply = $ai.chat({
        model: 'fast',
        messages: [
          { role: 'system', content: 'Responda apenas em JSON válido.' },
          { role: 'user', content: prompt },
        ],
      })

      let text = aiReply.choices[0].message.content.trim()
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

      return e.json(200, JSON.parse(text))
    } catch (err) {
      return e.internalServerError('Erro ao gerar conteúdo de Instagram: ' + String(err))
    }
  },
  $apis.requireAuth(),
)
