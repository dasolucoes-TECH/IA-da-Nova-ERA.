migrate(
  (app) => {
    var storesId = app.findCollectionByNameOrId('stores').id
    var usersId = '_pb_users_auth_'

    var storeRecord = null
    try {
      var stores = app.findRecordsByFilter('stores', "id != ''", 'created', 1, 0)
      if (stores.length > 0) storeRecord = stores[0]
    } catch (_) {}

    if (!storeRecord) return

    var ownerId = ''
    try {
      var members = app.findRecordsByFilter(
        'store_members',
        "store = {:sid} && role = 'OWNER'",
        '-created',
        1,
        0,
        { sid: storeRecord.id },
      )
      if (members.length > 0) ownerId = members[0].getString('user')
    } catch (_) {}

    var rulesCol = app.findCollectionByNameOrId('automation_rules')

    var defaults = [
      {
        name: 'SEO automático para produto novo',
        description: 'Gera SEO automaticamente quando um produto Shopify é criado sem SEO title.',
        trigger_type: 'SHOPIFY_PRODUCT_CREATED',
        conditions: { all: [{ field: 'product.seo_title', operator: 'is_empty' }] },
        action_type: 'GENERATE_PRODUCT_SEO',
        autonomy_mode: 'APPROVAL',
        cooldown_minutes: 0,
        max_executions_per_day: 50,
      },
      {
        name: 'Alerta de estoque crítico',
        description: 'Notifica quando o estoque de um produto fica abaixo de 3 unidades.',
        trigger_type: 'SHOPIFY_INVENTORY_UPDATED',
        conditions: { all: [{ field: 'inventory.quantity', operator: 'less_or_equal', value: 3 }] },
        action_type: 'CREATE_NOTIFICATION',
        action_config: {
          message_template: 'Estoque crítico: {produto} possui {quantidade} unidades.',
        },
        autonomy_mode: 'AUTOPILOT',
        cooldown_minutes: 720,
        max_executions_per_day: 20,
      },
      {
        name: 'Criar conteúdo de Instagram',
        description: 'Gera conteúdo de Instagram para novos produtos Shopify.',
        trigger_type: 'SHOPIFY_PRODUCT_CREATED',
        conditions: { all: [] },
        action_type: 'GENERATE_INSTAGRAM_CONTENT',
        autonomy_mode: 'APPROVAL',
        cooldown_minutes: 0,
        max_executions_per_day: 30,
      },
      {
        name: 'Analisar novo pedido',
        description: 'Analisa performance do produto quando um novo pedido é criado.',
        trigger_type: 'SHOPIFY_ORDER_CREATED',
        conditions: { all: [] },
        action_type: 'ANALYZE_PRODUCT_PERFORMANCE',
        autonomy_mode: 'SUGGEST',
        cooldown_minutes: 0,
        max_executions_per_day: 50,
      },
    ]

    for (var i = 0; i < defaults.length; i++) {
      var d = defaults[i]
      var existing = null
      try {
        existing = app.findFirstRecordByFilter(
          'automation_rules',
          'store = {:sid} && name = {:nm}',
          { sid: storeRecord.id, nm: d.name },
        )
      } catch (_) {}

      if (existing) continue

      var rec = new Record(rulesCol)
      rec.set('store', storeRecord.id)
      rec.set('name', d.name)
      rec.set('description', d.description)
      rec.set('enabled', false)
      rec.set('trigger_type', d.trigger_type)
      rec.set('trigger_config', '{}')
      rec.set('conditions', JSON.stringify(d.conditions))
      rec.set('action_type', d.action_type)
      rec.set('action_config', JSON.stringify(d.action_config || {}))
      rec.set('autonomy_mode', d.autonomy_mode)
      rec.set('priority', 5)
      rec.set('cooldown_minutes', d.cooldown_minutes)
      rec.set('max_executions_per_day', d.max_executions_per_day)
      rec.set('execution_count', 0)
      if (ownerId) rec.set('created_by', ownerId)
      app.save(rec)
    }
  },
  (app) => {
    try {
      var rules = app.findRecordsByFilter(
        'automation_rules',
        "name = 'SEO automático para produto novo' || name = 'Alerta de estoque crítico' || name = 'Criar conteúdo de Instagram' || name = 'Analisar novo pedido'",
        '-created',
        10,
        0,
      )
      for (var i = 0; i < rules.length; i++) {
        app.delete(rules[i])
      }
    } catch (_) {}
  },
)
