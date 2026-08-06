routerAdd(
  'POST',
  '/backend/v1/content/seo',
  (e) => {
    const body = e.requestInfo().body || {}
    const { productName, productDescription } = body

    if (!productName) {
      return e.badRequestError('productName é obrigatório')
    }

    const prompt = `Gere os dados de SEO otimizados para e-commerce do produto "${productName}" (Descrição: ${productDescription || 'N/A'}).
Responda ESTRITAMENTE em formato JSON com:
{
  "seo_title": "título chamativo SEO (máx 60 caracteres)",
  "meta_description": "meta descrição altamente clicável (máx 155 caracteres)",
  "keywords": "termo 1, termo 2, termo 3",
  "alt_text": "descrição da foto do produto",
  "slug": "nome-do-produto-url",
  "schema": {
    "@context": "https://schema.org/",
    "@type": "Product",
    "name": "${productName}"
  }
}`

    try {
      const aiReply = $ai.chat({
        model: 'fast',
        messages: [
          { role: 'system', content: 'Responda exclusivamente com o objeto JSON solicitado.' },
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
      return e.internalServerError('Erro ao gerar SEO: ' + String(err))
    }
  },
  $apis.requireAuth(),
)
