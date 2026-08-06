routerAdd(
  'POST',
  '/backend/v1/products/generate',
  (e) => {
    const body = e.requestInfo().body || {}
    const { name, currentDescription, price, cost, supplierName } = body

    if (!name) {
      return e.badRequestError('Nome do produto é obrigatório')
    }

    const prompt = `Você é um copywriter e especialista em e-commerce de elite.
Gere o conteúdo completo de alta conversão em Português (Brasil) para o seguinte produto:
- Nome: ${name}
- Descrição atual: ${currentDescription || 'Sem descrição'}
- Preço: R$ ${price || 0}
- Custo: R$ ${cost || 0}
- Fornecedor: ${supplierName || 'Geral'}

Responda ESTRITAMENTE em formato JSON com a seguinte estrutura:
{
  "description": "descrição comercial persuasiva e estruturada em parágrafos",
  "seo_title": "título SEO otimizado até 60 caracteres com palavra-chave",
  "meta_description": "meta descrição persuasiva até 155 caracteres com CTA",
  "keywords": "palavra-chave 1, palavra-chave 2, palavra-chave 3, e-commerce",
  "slug": "slug-amigavel-sem-acentos",
  "alt_text": "texto alternativo descritivo para a imagem principal",
  "faq": [
    {"question": "Dúvida comum 1?", "answer": "Resposta convincente 1"},
    {"question": "Dúvida comum 2?", "answer": "Resposta convincente 2"}
  ],
  "benefits": [
    "Benefício principal 1",
    "Benefício principal 2",
    "Benefício principal 3"
  ],
  "specifications": [
    {"label": "Material", "value": "Qualidade Premium"},
    {"label": "Garantia", "value": "90 dias"}
  ],
  "instagram_caption": "Legenda cativante para feed do Instagram com emojis e CTA",
  "instagram_hashtags": "#oferta #novidade #ecommerce #compras",
  "stories": "Roteiro de 3 telas de Stories para conversão",
  "email_marketing": "Assunto: Oferta Especial\n\nCorpo do e-mail focado em vendas..."
}`

    try {
      const aiReply = $ai.chat({
        model: 'reasoning',
        messages: [
          {
            role: 'system',
            content: 'Você responde apenas em JSON válido sem marcações markdown de código.',
          },
          { role: 'user', content: prompt },
        ],
      })

      let text = aiReply.choices[0].message.content.trim()
      if (text.startsWith('```json')) {
        text = text
          .replace(/^```json\s*/, '')
          .replace(/```$/, '')
          .trim()
      } else if (text.startsWith('```')) {
        text = text
          .replace(/^```\s*/, '')
          .replace(/```$/, '')
          .trim()
      }

      const data = JSON.parse(text)
      return e.json(200, data)
    } catch (err) {
      return e.internalServerError('Falha ao gerar conteúdo inteligente: ' + String(err))
    }
  },
  $apis.requireAuth(),
)
