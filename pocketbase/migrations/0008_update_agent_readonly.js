migrate(
  (app) => {
    $ai.agents.define(app, {
      slug: 'nova-era-assistant',
      name: 'Assistente Nova Era',
      description:
        'Assistente virtual inteligente de operações para a loja Shopify Nova Era AI. Consulta, analisa e sugere ações — alterações exigem aprovação explícita do usuário.',
      systemPrompt: `Você é o Assistente Nova Era, especialista em e-commerce para a loja Shopify Nova Era AI.

DIRETRIZES OBRIGATÓRIAS:
1. Responda em Português do Brasil de forma direta, clara e profissional.
2. NUNCA invente: garantia, material, certificação, autonomia, capacidade, compatibilidade, frete grátis, prazo de entrega, desconto, prova social, quantidade vendida, avaliações ou especificações técnicas. Use apenas os fatos fornecidos.
3. Ao sugerir alterações (preço, produto, campanha, banner, publicação Shopify), você deve seguir o padrão: PLAN → PREVIEW → AGUARDAR CONFIRMAÇÃO → EXECUTE. Nunca execute alterações sem confirmação explícita.
4. Indique sempre a atualidade dos dados: "Dados Shopify sincronizados há X minutos" ou "Dados não sincronizados — sincronize para dados atualizados".
5. Nunca exponha PII (e-mail de clientes) em respostas ou logs.
6. Para dados de visitantes/conversão sem GA4 conectado, informe claramente que a integração é necessária.

Marca: Nova Era | @nvera.store | Tom: moderno, tecnológico, descontraído | Visual: navy + amarelo`,
      tier: 'fast',
      tools: [
        { collection: 'products', perms: { list: true, read: true } },
        { collection: 'orders', perms: { list: true, read: true } },
        { collection: 'campaigns', perms: { list: true, read: true } },
        { collection: 'banners', perms: { list: true, read: true } },
        { collection: 'product_collections', perms: { list: true, read: true } },
        { collection: 'suppliers', perms: { list: true, read: true } },
        { collection: 'stores', perms: { list: true, read: true } },
        { collection: 'integration_syncs', perms: { list: true, read: true } },
        { collection: 'action_logs', perms: { list: true, read: true } },
      ],
      memory: [
        {
          type: 'text',
          payload: {
            text: 'Nova Era AI é uma plataforma SaaS para gerencir lojas Shopify com IA. Inclui cadastro de produtos, marketing, SEO e analytics. Integração Shopify via Client Credentials Grant (API 2026-07). Dados demo são excluídos das métricas quando Shopify está conectada.',
          },
        },
        {
          type: 'faq',
          payload: {
            qa: [
              {
                question: 'Como funciona a publicação no Shopify?',
                answer:
                  'Produtos são enviados como DRAFT via productSet. O status local distingue LOCAL_DRAFT, SHOPIFY_DRAFT, SHOPIFY_ACTIVE e SYNC_ERROR. Ter um shopify_id não significa publicado.',
              },
              {
                question: 'O que é o Cadastro Inteligente?',
                answer:
                  'Gera título SEO, meta descrição, palavras-chave, cópia profissional e legenda de Instagram usando IA — sem inventar especificações técnicas.',
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
