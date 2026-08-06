migrate(
  (app) => {
    $ai.agents.define(app, {
      slug: 'nova-era-assistant',
      name: 'Assistente Nova Era',
      description: 'Assistente virtual inteligente de operações para a loja Shopify Nova Era AI.',
      systemPrompt: `Você é o Assistente Nova Era, o especialista em e-commerce e inteligência artificial para a loja Shopify Nova Era AI.
Você auxilia o lojista a gerenciar produtos, criar promoções, analisar vendas, otimizar SEO, sugerir posts para Instagram e automatizar a loja.

Diretrizes:
1. Responda em Português do Brasil de forma direta, clara e profissional.
2. Quando solicitado para criar ou atualizar produtos, campanhas ou banners, utilize as ferramentas disponíveis.
3. Quando responder dúvidas sobre vendas ou estoque, cite os dados reais da loja.
4. Para tarefas fora do escopo ou que exijam chaves externas de API não configuradas, explique amigavelmente que o ajuste será feito localmente no painel.
5. Quando o usuário perguntar o que você pode fazer, resuma suas capacidades principais (Cadastro Inteligente, Análise de Vendas, Banners, Posts de Instagram, Promoções).`,
      tier: 'fast',
      tools: [
        { collection: 'products', perms: { list: true, read: true, create: true, update: true } },
        { collection: 'orders', perms: { list: true, read: true } },
        { collection: 'campaigns', perms: { list: true, read: true, create: true, update: true } },
        { collection: 'banners', perms: { list: true, read: true, create: true, update: true } },
        { collection: 'product_collections', perms: { list: true, read: true } },
        { collection: 'suppliers', perms: { list: true, read: true } },
      ],
      memory: [
        {
          type: 'text',
          payload: {
            text: 'Nova Era AI é uma plataforma SaaS inteligente para gerenciar lojas Shopify com Inteligência Artificial, englobando cadastro de produtos, marketing, SEO e analytics.',
          },
        },
        {
          type: 'faq',
          payload: {
            qa: [
              {
                question: 'Como funciona a publicação no Shopify?',
                answer:
                  "Na tela Shopify do painel, você pode clicar em 'Publicar rascunhos' para transformar produtos de rascunho em publicados.",
              },
              {
                question: 'O que é o Cadastro Inteligente?',
                answer:
                  'É o recurso que gera título SEO, meta descrição, palavras-chave, cópia profissional, legenda de Instagram e e-mail marketing para produtos usando IA.',
              },
              {
                question: 'Como calcular margem de lucro?',
                answer: 'Margem (%) = ((Preço de Venda - Custo) / Preço de Venda) * 100.',
              },
            ],
          },
        },
      ],
    })
  },
  (app) => {
    try {
      $ai.agents.delete(app, 'nova-era-assistant')
    } catch (_) {}
  },
)
