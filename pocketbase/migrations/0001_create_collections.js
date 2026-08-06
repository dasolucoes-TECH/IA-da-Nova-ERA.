migrate(
  (app) => {
    const pc = new Collection({
      name: 'product_collections',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'handle', type: 'text', required: true },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_product_collections_handle ON product_collections (handle)',
      ],
    })
    app.save(pc)

    const sup = new Collection({
      name: 'suppliers',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'contact_email', type: 'email' },
        { name: 'phone', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })
    app.save(sup)

    const supId = app.findCollectionByNameOrId('suppliers').id
    const pcId = app.findCollectionByNameOrId('product_collections').id

    const prod = new Collection({
      name: 'products',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'description', type: 'text' },
        { name: 'price', type: 'number', required: true },
        { name: 'cost', type: 'number' },
        { name: 'stock', type: 'number' },
        { name: 'supplier', type: 'relation', collectionId: supId, maxSelect: 1 },
        { name: 'collection', type: 'relation', collectionId: pcId, maxSelect: 1 },
        { name: 'status', type: 'select', values: ['rascunho', 'publicado'], maxSelect: 1 },
        {
          name: 'images',
          type: 'file',
          maxSelect: 10,
          maxSize: 5242880,
          mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
        },
        { name: 'slug', type: 'text' },
        { name: 'seo_title', type: 'text' },
        { name: 'meta_description', type: 'text' },
        { name: 'keywords', type: 'text' },
        { name: 'alt_text', type: 'text' },
        { name: 'schema', type: 'json' },
        { name: 'faq', type: 'json' },
        { name: 'benefits', type: 'json' },
        { name: 'specifications', type: 'json' },
        { name: 'instagram_caption', type: 'text' },
        { name: 'instagram_hashtags', type: 'text' },
        { name: 'stories', type: 'text' },
        { name: 'carousel', type: 'text' },
        { name: 'email_marketing', type: 'text' },
        { name: 'sales_count', type: 'number' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_products_status ON products (status)',
        'CREATE INDEX idx_products_created ON products (created DESC)',
        'CREATE INDEX idx_products_price ON products (price)',
      ],
    })
    app.save(prod)

    const prodId = app.findCollectionByNameOrId('products').id

    const orders = new Collection({
      name: 'orders',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'order_number', type: 'text', required: true },
        { name: 'customer_name', type: 'text' },
        { name: 'customer_email', type: 'text' },
        { name: 'total', type: 'number', required: true },
        {
          name: 'status',
          type: 'select',
          values: ['pending', 'paid', 'shipped', 'delivered', 'cancelled'],
          maxSelect: 1,
        },
        { name: 'items', type: 'json' },
        { name: 'source', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_orders_order_number ON orders (order_number)',
        'CREATE INDEX idx_orders_status ON orders (status)',
        'CREATE INDEX idx_orders_created ON orders (created DESC)',
      ],
    })
    app.save(orders)

    const camp = new Collection({
      name: 'campaigns',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'name', type: 'text', required: true },
        {
          name: 'type',
          type: 'select',
          values: ['desconto', 'banner', 'landing', 'social'],
          maxSelect: 1,
        },
        { name: 'products', type: 'relation', collectionId: prodId, maxSelect: 10 },
        { name: 'coupon_code', type: 'text' },
        { name: 'discount_percent', type: 'number' },
        { name: 'spend', type: 'number' },
        {
          name: 'status',
          type: 'select',
          values: ['draft', 'active', 'paused', 'ended'],
          maxSelect: 1,
        },
        { name: 'description', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_campaigns_status ON campaigns (status)',
        'CREATE INDEX idx_campaigns_type ON campaigns (type)',
      ],
    })
    app.save(camp)

    const ban = new Collection({
      name: 'banners',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'title', type: 'text', required: true },
        { name: 'subtitle', type: 'text' },
        {
          name: 'image',
          type: 'file',
          maxSelect: 1,
          maxSize: 5242880,
          mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
        },
        { name: 'link', type: 'text' },
        { name: 'position', type: 'select', values: ['hero', 'promo', 'footer'], maxSelect: 1 },
        { name: 'active', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_banners_position ON banners (position)',
        'CREATE INDEX idx_banners_active ON banners (active)',
      ],
    })
    app.save(ban)

    const ae = new Collection({
      name: 'analytics_events',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'event_type',
          type: 'select',
          values: ['visit', 'sale', 'conversion'],
          maxSelect: 1,
        },
        { name: 'product', type: 'relation', collectionId: prodId, maxSelect: 1 },
        { name: 'value', type: 'number' },
        { name: 'source', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_analytics_events_type ON analytics_events (event_type)',
        'CREATE INDEX idx_analytics_events_created ON analytics_events (created DESC)',
      ],
    })
    app.save(ae)
  },
  (app) => {
    const names = [
      'analytics_events',
      'banners',
      'campaigns',
      'orders',
      'products',
      'suppliers',
      'product_collections',
    ]
    for (const n of names) {
      try {
        const col = app.findCollectionByNameOrId(n)
        app.delete(col)
      } catch (_) {}
    }
  },
)
