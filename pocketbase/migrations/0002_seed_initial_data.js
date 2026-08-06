migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    try {
      app.findAuthRecordByEmail('_pb_users_auth_', 'dasolucoestst@gmail.com')
    } catch (_) {
      const admin = new Record(users)
      admin.setEmail('dasolucoestst@gmail.com')
      admin.setPassword('Skip@Pass')
      admin.setVerified(true)
      admin.set('name', 'Admin Nova Era')
      app.save(admin)
    }

    const pcCol = app.findCollectionByNameOrId('product_collections')
    const pcData = [
      { name: 'Moda', handle: 'moda' },
      { name: 'Eletrônicos', handle: 'eletronicos' },
      { name: 'Casa & Decoração', handle: 'casa-decoracao' },
      { name: 'Beleza', handle: 'beleza' },
    ]
    for (const item of pcData) {
      try {
        app.findFirstRecordByData('product_collections', 'handle', item.handle)
      } catch (_) {
        const rec = new Record(pcCol)
        rec.set('name', item.name)
        rec.set('handle', item.handle)
        app.save(rec)
      }
    }

    const supCol = app.findCollectionByNameOrId('suppliers')
    const supData = [
      {
        name: 'Fornecedor Alpha',
        contact_email: 'alpha@fornecedor.com',
        phone: '+55 11 99999-1111',
      },
      { name: 'Fornecedor Beta', contact_email: 'beta@fornecedor.com', phone: '+55 21 98888-2222' },
    ]
    for (const item of supData) {
      try {
        app.findFirstRecordByData('suppliers', 'name', item.name)
      } catch (_) {
        const rec = new Record(supCol)
        rec.set('name', item.name)
        rec.set('contact_email', item.contact_email)
        rec.set('phone', item.phone)
        app.save(rec)
      }
    }

    const alphaSup = app.findFirstRecordByData('suppliers', 'name', 'Fornecedor Alpha')
    const betaSup = app.findFirstRecordByData('suppliers', 'name', 'Fornecedor Beta')
    const modaPc = app.findFirstRecordByData('product_collections', 'handle', 'moda')
    const eletroPc = app.findFirstRecordByData('product_collections', 'handle', 'eletronicos')
    const casaPc = app.findFirstRecordByData('product_collections', 'handle', 'casa-decoracao')
    const belezaPc = app.findFirstRecordByData('product_collections', 'handle', 'beleza')

    const prodCol = app.findCollectionByNameOrId('products')
    const products = [
      {
        name: 'Camiseta Oversized Premium',
        description:
          'Camiseta 100% algodão egípcio com corte oversized moderno e toque ultra macio.',
        price: 189.9,
        cost: 65.0,
        stock: 45,
        supplier: alphaSup.id,
        collection: modaPc.id,
        status: 'publicado',
        slug: 'camiseta-oversized-premium',
        sales_count: 142,
      },
      {
        name: 'Fone Bluetooth Pro Noise Cancelling',
        description:
          'Headphone sem fio com cancelamento ativo de ruído, bateria de 40h e som espacial.',
        price: 499.0,
        cost: 180.0,
        stock: 3,
        supplier: betaSup.id,
        collection: eletroPc.id,
        status: 'publicado',
        slug: 'fone-bluetooth-pro',
        sales_count: 98,
      },
      {
        name: 'Luminária de Mesa Inteligente LED',
        description:
          'Luminária articulada com controle por app, ajuste de temperatura de cor e dimmer.',
        price: 249.9,
        cost: 85.0,
        stock: 12,
        supplier: alphaSup.id,
        collection: casaPc.id,
        status: 'publicado',
        slug: 'luminaria-de-mesa-inteligente',
        sales_count: 76,
      },
      {
        name: 'Kit Skincare Facial Sérum + Hidratante',
        description:
          'Duo rejuvenescedor com Ácido Hialurônico e Vitamina C pura para todos os tipos de pele.',
        price: 159.0,
        cost: 42.0,
        stock: 2,
        supplier: betaSup.id,
        collection: belezaPc.id,
        status: 'publicado',
        slug: 'kit-skincare-facial',
        sales_count: 215,
      },
      {
        name: 'Garrafa Térmica Aço Inox 1L',
        description:
          'Garrafa de parede dupla a vácuo que mantém bebidas geladas por 24h ou quentes por 12h.',
        price: 129.9,
        cost: 38.0,
        stock: 60,
        supplier: alphaSup.id,
        collection: casaPc.id,
        status: 'publicado',
        slug: 'garrafa-termica-aco-inox',
        sales_count: 110,
      },
      {
        name: 'Relógio Minimalista Couro Legítimo',
        description:
          'Relógio analógico resistente à água 5ATM com pulseira de couro italiano costurada à mão.',
        price: 389.0,
        cost: 120.0,
        stock: 4,
        supplier: betaSup.id,
        collection: modaPc.id,
        status: 'publicado',
        slug: 'relogio-minimalista-couro',
        sales_count: 54,
      },
      {
        name: 'Caixa de Som Portátil Waterproof',
        description:
          'Caixa de som Bluetooth IPX7 resistente à água com 20W de potência e graves profundos.',
        price: 299.9,
        cost: 95.0,
        stock: 28,
        supplier: alphaSup.id,
        collection: eletroPc.id,
        status: 'rascunho',
        slug: 'caixa-de-som-portatil',
        sales_count: 0,
      },
      {
        name: 'Tênis Casual Runner Urban',
        description: 'Tênis leve com amortecimento em EVA e tecido respirável para o dia a dia.',
        price: 329.0,
        cost: 110.0,
        stock: 18,
        supplier: betaSup.id,
        collection: modaPc.id,
        status: 'publicado',
        slug: 'tenis-casual-runner-urban',
        sales_count: 88,
      },
    ]

    for (const p of products) {
      try {
        app.findFirstRecordByData('products', 'slug', p.slug)
      } catch (_) {
        const rec = new Record(prodCol)
        rec.set('name', p.name)
        rec.set('description', p.description)
        rec.set('price', p.price)
        rec.set('cost', p.cost)
        rec.set('stock', p.stock)
        rec.set('supplier', p.supplier)
        rec.set('collection', p.collection)
        rec.set('status', p.status)
        rec.set('slug', p.slug)
        rec.set('sales_count', p.sales_count)
        rec.set('seo_title', `${p.name} | Frete Grátis`)
        rec.set('meta_description', p.description)
        rec.set('keywords', `${p.name}, oferta, comprar online, loja oficial`)
        rec.set('alt_text', `Foto de ${p.name}`)
        app.save(rec)
      }
    }

    const orderCol = app.findCollectionByNameOrId('orders')
    const orders = [
      {
        num: '#1001',
        name: 'Lucas Silva',
        email: 'lucas@email.com',
        total: 379.8,
        status: 'delivered',
        source: 'shopify',
      },
      {
        num: '#1002',
        name: 'Mariana Costa',
        email: 'mariana@email.com',
        total: 499.0,
        status: 'delivered',
        source: 'shopify',
      },
      {
        num: '#1003',
        name: 'Carlos Eduardo',
        email: 'carlos@email.com',
        total: 189.9,
        status: 'shipped',
        source: 'instagram',
      },
      {
        num: '#1004',
        name: 'Beatriz Lima',
        email: 'beatriz@email.com',
        total: 658.0,
        status: 'paid',
        source: 'shopify',
      },
      {
        num: '#1005',
        name: 'Gabriel Santos',
        email: 'gabriel@email.com',
        total: 249.9,
        status: 'paid',
        source: 'marketplace',
      },
      {
        num: '#1006',
        name: 'Fernanda Alves',
        email: 'fernanda@email.com',
        total: 159.0,
        status: 'pending',
        source: 'shopify',
      },
      {
        num: '#1007',
        name: 'Rodrigo Melo',
        email: 'rodrigo@email.com',
        total: 389.0,
        status: 'paid',
        source: 'instagram',
      },
      {
        num: '#1008',
        name: 'Juliana Rocha',
        email: 'juliana@email.com',
        total: 129.9,
        status: 'delivered',
        source: 'shopify',
      },
      {
        num: '#1009',
        name: 'Thiago Oliveira',
        email: 'thiago@email.com',
        total: 329.0,
        status: 'shipped',
        source: 'shopify',
      },
      {
        num: '#1010',
        name: 'Aline Souza',
        email: 'aline@email.com',
        total: 189.9,
        status: 'delivered',
        source: 'instagram',
      },
    ]

    for (const o of orders) {
      try {
        app.findFirstRecordByData('orders', 'order_number', o.num)
      } catch (_) {
        const rec = new Record(orderCol)
        rec.set('order_number', o.num)
        rec.set('customer_name', o.name)
        rec.set('customer_email', o.email)
        rec.set('total', o.total)
        rec.set('status', o.status)
        rec.set('source', o.source)
        rec.set(
          'items',
          JSON.stringify([{ product_name: 'Item da compra', quantity: 1, price: o.total }]),
        )
        app.save(rec)
      }
    }

    const campCol = app.findCollectionByNameOrId('campaigns')
    const campaigns = [
      {
        name: 'Promoção de Verão 2026',
        type: 'desconto',
        coupon_code: 'VERAO15',
        discount_percent: 15,
        spend: 1200.0,
        status: 'active',
        description: 'Campanha de ofertas de verão com desconto em Moda e Eletrônicos.',
      },
      {
        name: 'Lançamento Coleção Outono',
        type: 'social',
        coupon_code: 'OUTONO10',
        discount_percent: 10,
        spend: 450.0,
        status: 'draft',
        description: 'Divulgação de novas peças no Instagram e TikTok.',
      },
    ]

    for (const c of campaigns) {
      try {
        app.findFirstRecordByData('campaigns', 'name', c.name)
      } catch (_) {
        const rec = new Record(campCol)
        rec.set('name', c.name)
        rec.set('type', c.type)
        rec.set('coupon_code', c.coupon_code)
        rec.set('discount_percent', c.discount_percent)
        rec.set('spend', c.spend)
        rec.set('status', c.status)
        rec.set('description', c.description)
        app.save(rec)
      }
    }

    const banCol = app.findCollectionByNameOrId('banners')
    const banners = [
      {
        title: 'Verão de Ofertas Nova Era',
        subtitle: 'Até 40% OFF nos produtos selecionados',
        position: 'hero',
        active: true,
        link: '/produtos',
      },
      {
        title: 'Lançamento Exclusivo',
        subtitle: 'Frete Grátis para todo o Brasil',
        position: 'promo',
        active: true,
        link: '/marketing',
      },
    ]

    for (const b of banners) {
      try {
        app.findFirstRecordByData('banners', 'title', b.title)
      } catch (_) {
        const rec = new Record(banCol)
        rec.set('title', b.title)
        rec.set('subtitle', b.subtitle)
        rec.set('position', b.position)
        rec.set('active', b.active)
        rec.set('link', b.link)
        app.save(rec)
      }
    }

    const aeCol = app.findCollectionByNameOrId('analytics_events')
    try {
      if (app.countRecords('analytics_events') === 0) {
        for (let i = 0; i < 45; i++) {
          const rec1 = new Record(aeCol)
          rec1.set('event_type', 'visit')
          rec1.set('value', 1)
          rec1.set('source', i % 2 === 0 ? 'shopify' : 'instagram')
          app.save(rec1)
        }
        for (let i = 0; i < 15; i++) {
          const rec2 = new Record(aeCol)
          rec2.set('event_type', 'conversion')
          rec2.set('value', 189.9)
          rec2.set('source', 'shopify')
          app.save(rec2)
        }
      }
    } catch (_) {}
  },
  (app) => {},
)
