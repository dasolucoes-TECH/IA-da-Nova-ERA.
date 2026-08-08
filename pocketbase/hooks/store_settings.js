routerAdd(
  'GET',
  '/backend/v1/store/settings',
  (e) => {
    try {
      var userId = e.auth ? e.auth.id : ''
      if (!userId) return e.unauthorizedError('Autenticação necessária')

      var storeRecord = $app.__shopifyGetStore()
      if (!storeRecord) return e.json(200, {})

      return e.json(200, {
        store_name: storeRecord.getString('name') || '',
        brand_name: storeRecord.getString('shopify_shop_name') || 'Nova Era',
        myshopify_domain: storeRecord.getString('myshopify_domain') || '',
        primary_domain: storeRecord.getString('primary_domain') || '',
        api_version: storeRecord.getString('api_version') || '',
        connected: storeRecord.getBool('connected'),
        last_product_sync: storeRecord.getString('last_product_sync') || '',
        last_order_sync: storeRecord.getString('last_order_sync') || '',
      })
    } catch (err) {
      return e.internalServerError('Erro: ' + String(err))
    }
  },
  $apis.requireAuth(),
)

routerAdd(
  'PUT',
  '/backend/v1/store/settings',
  (e) => {
    try {
      var userId = e.auth ? e.auth.id : ''
      if (!userId) return e.unauthorizedError('Autenticação necessária')

      var body = e.requestInfo().body || {}
      var storeRecord = $app.__shopifyGetStore()
      if (!storeRecord) return e.json(404, { error: 'Loja não encontrada' })

      if (body.store_name) storeRecord.set('name', body.store_name)
      if (body.api_version) storeRecord.set('api_version', body.api_version)

      $app.save(storeRecord)

      $app.__shopifyLogAction(
        storeRecord.id,
        userId,
        'update_settings',
        'store',
        storeRecord.id,
        'EXECUTED',
        'Configurações da loja atualizadas',
      )

      return e.json(200, { success: true })
    } catch (err) {
      return e.internalServerError('Erro ao salvar: ' + String(err))
    }
  },
  $apis.requireAuth(),
)
