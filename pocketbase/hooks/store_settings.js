routerAdd(
  'GET',
  '/backend/v1/store/settings',
  (e) => {
    try {
      var userId = e.auth ? e.auth.id : ''
      if (!userId) return e.unauthorizedError('Auth required')

      var storeRecord = null
      try {
        var stores = $app.findRecordsByFilter('stores', "id != ''", 'created', 1, 0)
        if (stores.length > 0) storeRecord = stores[0]
      } catch (_) {}

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
        autopilot_enabled: storeRecord.getBool('autopilot_enabled'),
      })
    } catch (err) {
      return e.internalServerError('Error: ' + String(err))
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
      if (!userId) return e.unauthorizedError('Auth required')

      var body = e.requestInfo().body || {}
      var storeRecord = null
      try {
        var stores = $app.findRecordsByFilter('stores', "id != ''", 'created', 1, 0)
        if (stores.length > 0) storeRecord = stores[0]
      } catch (_) {}

      if (!storeRecord) return e.json(404, { error: 'Store not found' })

      if (body.store_name) storeRecord.set('name', body.store_name)
      if (body.api_version) storeRecord.set('api_version', body.api_version)
      if (body.autopilot_enabled !== undefined)
        storeRecord.set('autopilot_enabled', body.autopilot_enabled)
      $app.save(storeRecord)

      try {
        var logCol = $app.findCollectionByNameOrId('action_logs')
        var logRec = new Record(logCol)
        logRec.set('store', storeRecord.id)
        logRec.set('user', userId)
        logRec.set('action_type', 'update_settings')
        logRec.set('entity_type', 'store')
        logRec.set('entity_id', storeRecord.id)
        logRec.set('status', 'EXECUTED')
        logRec.set('summary', 'Store settings updated')
        $app.save(logRec)
      } catch (_) {}

      return e.json(200, { success: true })
    } catch (err) {
      return e.internalServerError('Error saving: ' + String(err))
    }
  },
  $apis.requireAuth(),
)
