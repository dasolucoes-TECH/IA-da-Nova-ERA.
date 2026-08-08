migrate(
  (app) => {
    const storesCol = new Collection({
      name: 'stores',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'myshopify_domain', type: 'text' },
        { name: 'primary_domain', type: 'text' },
        { name: 'shopify_shop_name', type: 'text' },
        { name: 'shopify_shop_gid', type: 'text' },
        { name: 'api_version', type: 'text' },
        { name: 'connected', type: 'bool' },
        { name: 'last_product_sync', type: 'date' },
        { name: 'last_order_sync', type: 'date' },
        { name: 'cached_token', type: 'text', hidden: true },
        { name: 'token_expires_at', type: 'date', hidden: true },
        { name: 'cached_scopes', type: 'text', hidden: true },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        "CREATE UNIQUE INDEX idx_stores_myshopify_domain ON stores (myshopify_domain) WHERE myshopify_domain != ''",
      ],
    })
    app.save(storesCol)

    const storesId = app.findCollectionByNameOrId('stores').id

    const storeMembersCol = new Collection({
      name: 'store_members',
      type: 'base',
      listRule: 'user = @request.auth.id',
      viewRule: 'user = @request.auth.id',
      createRule: "@request.auth.id != ''",
      updateRule: 'user = @request.auth.id',
      deleteRule: 'user = @request.auth.id',
      fields: [
        {
          name: 'store',
          type: 'relation',
          collectionId: storesId,
          required: true,
          maxSelect: 1,
          cascadeDelete: true,
        },
        {
          name: 'user',
          type: 'relation',
          collectionId: '_pb_users_auth_',
          required: true,
          maxSelect: 1,
        },
        {
          name: 'role',
          type: 'select',
          values: ['OWNER', 'ADMIN', 'EDITOR', 'VIEWER'],
          maxSelect: 1,
          required: true,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_store_members_store_user ON store_members (store, user)'],
    })
    app.save(storeMembersCol)

    const smId = app.findCollectionByNameOrId('store_members').id
    const storesCol2 = app.findCollectionByNameOrId('stores')
    if (!storesCol2.fields.getByName('members')) {
      storesCol2.fields.add(
        new RelationField({ name: 'members', collectionId: smId, maxSelect: 0 }),
      )
    }
    storesCol2.listRule = 'members.user = @request.auth.id'
    storesCol2.viewRule = 'members.user = @request.auth.id'
    storesCol2.updateRule = 'members.user = @request.auth.id'
    storesCol2.deleteRule = "members.user = @request.auth.id && members.role = 'OWNER'"
    app.save(storesCol2)

    const actionLogsCol = new Collection({
      name: 'action_logs',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'store',
          type: 'relation',
          collectionId: storesId,
          required: true,
          maxSelect: 1,
          cascadeDelete: true,
        },
        {
          name: 'user',
          type: 'relation',
          collectionId: '_pb_users_auth_',
          required: true,
          maxSelect: 1,
        },
        { name: 'action_type', type: 'text', required: true },
        { name: 'entity_type', type: 'text' },
        { name: 'entity_id', type: 'text' },
        {
          name: 'status',
          type: 'select',
          values: ['PROPOSED', 'APPROVED', 'EXECUTED', 'FAILED', 'CANCELLED'],
          maxSelect: 1,
        },
        { name: 'summary', type: 'text' },
        { name: 'before_snapshot', type: 'json' },
        { name: 'after_snapshot', type: 'json' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_action_logs_store ON action_logs (store)',
        'CREATE INDEX idx_action_logs_created ON action_logs (created DESC)',
      ],
    })
    app.save(actionLogsCol)

    const integrationSyncsCol = new Collection({
      name: 'integration_syncs',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'store',
          type: 'relation',
          collectionId: storesId,
          required: true,
          maxSelect: 1,
          cascadeDelete: true,
        },
        { name: 'sync_type', type: 'text', required: true },
        { name: 'status', type: 'text' },
        { name: 'started_at', type: 'date' },
        { name: 'completed_at', type: 'date' },
        { name: 'records_processed', type: 'number' },
        { name: 'records_created', type: 'number' },
        { name: 'records_updated', type: 'number' },
        { name: 'errors', type: 'json' },
        { name: 'meta', type: 'json' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_integration_syncs_store ON integration_syncs (store)',
        'CREATE INDEX idx_integration_syncs_type ON integration_syncs (sync_type)',
      ],
    })
    app.save(integrationSyncsCol)

    const prodId = app.findCollectionByNameOrId('products').id

    const productVariantsCol = new Collection({
      name: 'product_variants',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'store', type: 'relation', collectionId: storesId, required: true, maxSelect: 1 },
        {
          name: 'product',
          type: 'relation',
          collectionId: prodId,
          required: true,
          maxSelect: 1,
          cascadeDelete: true,
        },
        { name: 'shopify_variant_id', type: 'text' },
        { name: 'title', type: 'text' },
        { name: 'sku', type: 'text' },
        { name: 'barcode', type: 'text' },
        { name: 'price', type: 'number' },
        { name: 'compare_at_price', type: 'number' },
        { name: 'inventory_quantity', type: 'number' },
        { name: 'inventory_item_id', type: 'text' },
        { name: 'selected_options', type: 'json' },
        { name: 'position', type: 'number' },
        { name: 'created_at_shopify', type: 'date' },
        { name: 'updated_at_shopify', type: 'date' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        "CREATE UNIQUE INDEX idx_product_variants_store_shopify_id ON product_variants (store, shopify_variant_id) WHERE shopify_variant_id != ''",
        'CREATE INDEX idx_product_variants_product ON product_variants (product)',
      ],
    })
    app.save(productVariantsCol)

    const productMediaCol = new Collection({
      name: 'product_media',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'store', type: 'relation', collectionId: storesId, required: true, maxSelect: 1 },
        {
          name: 'product',
          type: 'relation',
          collectionId: prodId,
          required: true,
          maxSelect: 1,
          cascadeDelete: true,
        },
        { name: 'shopify_media_id', type: 'text' },
        { name: 'url', type: 'url' },
        { name: 'alt', type: 'text' },
        { name: 'media_type', type: 'text' },
        { name: 'position', type: 'number' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        "CREATE UNIQUE INDEX idx_product_media_store_shopify_id ON product_media (store, shopify_media_id) WHERE shopify_media_id != ''",
        'CREATE INDEX idx_product_media_product ON product_media (product)',
      ],
    })
    app.save(productMediaCol)
  },
  (app) => {
    const names = [
      'product_media',
      'product_variants',
      'integration_syncs',
      'action_logs',
      'store_members',
      'stores',
    ]
    for (const n of names) {
      try {
        const col = app.findCollectionByNameOrId(n)
        app.delete(col)
      } catch (_) {}
    }
  },
)
