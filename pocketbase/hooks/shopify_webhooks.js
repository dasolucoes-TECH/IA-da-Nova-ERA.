routerAdd('POST', '/backend/v1/shopify/webhook', (e) => {
  try {
    var rawBody = ''
    try {
      rawBody = readerToString(e.request.body)
    } catch (_) {
      rawBody = ''
    }

    var hmacHeader = e.request.header.get('X-Shopify-Hmac-Sha256') || ''
    var clientSecret = $secrets.get('SHOPIFY_CLIENT_SECRET') || ''
    if (!clientSecret) return e.json(401, { error: 'Webhook secret not configured' })

    function base64ToHex(b64) {
      var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
      var clean = b64.replace(/=+$/, '')
      var hex = ''
      for (var i = 0; i < clean.length; i += 4) {
        var n = 0
        for (var j = 0; j < 4 && i + j < clean.length; j++) {
          n = n * 64 + chars.indexOf(clean[i + j])
        }
        hex += ((n >> 16) & 255).toString(16).padStart(2, '0')
        if (i + 2 < clean.length) hex += ((n >> 8) & 255).toString(16).padStart(2, '0')
        if (i + 3 < clean.length) hex += (n & 255).toString(16).padStart(2, '0')
      }
      return hex
    }

    function constantTimeCompare(a, b) {
      if (a.length !== b.length) return false
      var result = 0
      for (var i = 0; i < a.length; i++) {
        result |= a.charCodeAt(i) ^ b.charCodeAt(i)
      }
      return result === 0
    }

    var computedHmac = $security.hs256(rawBody, clientSecret)
    var headerHex = base64ToHex(hmacHeader)
    if (!constantTimeCompare(computedHmac, headerHex)) {
      $app.logger().warn('Shopify webhook HMAC invalid', 'ip', e.request.remoteAddr)
      return e.json(401, { error: 'HMAC invalid' })
    }

    var body = JSON.parse(rawBody)
    var topic = e.request.header.get('X-Shopify-Topic') || ''
    var webhookId = e.request.header.get('X-Shopify-Webhook-Id') || ''
    var eventId = e.request.header.get('X-Shopify-Event-Id') || ''
    var shopDomain = e.request.header.get('X-Shopify-Shop-Domain') || ''

    function normalizeDomain(d) {
      if (!d) return ''
      return d
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, '')
        .replace(/\/.*$/, '')
    }

    var normalizedDomain = normalizeDomain(shopDomain)
    $app
      .logger()
      .info('Shopify webhook received', 'topic', topic, 'id', body.id || '', 'webhookId', webhookId)

    var storeRecord = null
    try {
      var stores = $app.findRecordsByFilter('stores', 'myshopify_domain = {:md}', 'created', 1, 0, {
        md: normalizedDomain,
      })
      if (stores.length > 0) storeRecord = stores[0]
    } catch (_) {}

    if (topic === 'app/uninstalled') {
      if (storeRecord) {
        storeRecord.set('connected', false)
        $app.save(storeRecord)
      }
      return e.json(200, { received: true })
    }

    if (!storeRecord) {
      $app.logger().warn('Shopify webhook: no store found for domain', 'domain', normalizedDomain)
      return e.json(200, { received: true, message: 'No store matched' })
    }

    var storeId = storeRecord.id
    var eventType = ''
    var entityType = ''
    var entityId = ''
    var payload = {}

    function resolveLocalEntity(type, shopifyId) {
      if (type === 'product') {
        try {
          var product = $app.findFirstRecordByFilter(
            'products',
            'shopify_id = {:sid} && store = {:st}',
            { sid: shopifyId, st: storeId },
          )
          return { localId: product.id, name: product.getString('name') }
        } catch (_) {}
      } else if (type === 'inventory') {
        try {
          var variant = $app.findFirstRecordByFilter(
            'product_variants',
            'inventory_item_id = {:iid} && store = {:st}',
            { iid: shopifyId, st: storeId },
          )
          if (variant) {
            var productId = variant.getString('product')
            var product = $app.findRecordById('products', productId)
            return { localId: product.id, name: product.getString('name') }
          }
        } catch (_) {}
      }
      return { localId: null, name: null }
    }

    if (topic === 'products/create' || topic === 'products/update') {
      eventType =
        topic === 'products/create' ? 'SHOPIFY_PRODUCT_CREATED' : 'SHOPIFY_PRODUCT_UPDATED'
      entityType = 'product'
      var shopifyProductId = body.id ? String(body.id) : ''
      var resolved = resolveLocalEntity('product', shopifyProductId)
      entityId = resolved.localId || shopifyProductId
      payload = {
        product: {
          shopify_id: shopifyProductId,
          local_id: resolved.localId,
          name: body.title || resolved.name,
        },
        seo_title: body.seo_title || '',
      }
    } else if (topic === 'orders/create') {
      eventType = 'SHOPIFY_ORDER_CREATED'
      entityType = 'order'
      entityId = body.id ? String(body.id) : ''
      payload = {
        order: {
          id: body.id,
          name: body.name,
          total_price: body.total_price,
          financial_status: body.financial_status || '',
        },
      }
    } else if (topic === 'orders/paid') {
      eventType = 'SHOPIFY_ORDER_PAID'
      entityType = 'order'
      entityId = body.id ? String(body.id) : ''
      payload = { order: { id: body.id, name: body.name, total_price: body.total_price } }
    } else if (topic === 'orders/fulfilled') {
      eventType = 'SHOPIFY_ORDER_FULFILLED'
      entityType = 'order'
      entityId = body.id ? String(body.id) : ''
      payload = { order: { id: body.id, name: body.name } }
    } else if (topic === 'inventory_levels/update') {
      eventType = 'SHOPIFY_INVENTORY_UPDATED'
      entityType = 'inventory'
      var invItemId = body.inventory_item_id ? String(body.inventory_item_id) : ''
      var invResolved = resolveLocalEntity('inventory', invItemId)
      entityId = invResolved.localId || invItemId
      var quantity = body.available != null ? body.available : 0
      payload = {
        inventory: { item_id: invItemId, quantity: quantity },
        product: { local_id: invResolved.localId, name: invResolved.name },
      }
    }

    if (!eventType) return e.json(200, { received: true })

    var dedupKey = ''
    if (webhookId) {
      dedupKey = 'shopify:' + storeId + ':' + webhookId
    } else if (eventId) {
      dedupKey = 'shopify:' + storeId + ':' + eventId
    } else {
      dedupKey =
        'shopify:' +
        storeId +
        ':' +
        normalizedDomain +
        ':' +
        topic +
        ':' +
        entityId +
        ':' +
        (body.updated_at || new Date().toISOString())
    }

    var baseUrl = $secrets.get('PB_INSTANCE_URL') || ''
    var internalSecret = $secrets.get('PB_SUPERUSER_TOKEN') || ''
    try {
      $http.send({
        url: baseUrl + '/backend/v1/autopilot/emit-event-core',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Internal-Secret': internalSecret },
        body: JSON.stringify({
          storeId: storeId,
          eventType: eventType,
          source: 'shopify_webhook',
          entityType: entityType,
          entityId: entityId,
          payload: payload,
          deduplicationKey: dedupKey,
        }),
        timeout: 30,
      })
    } catch (sendErr) {
      $app.logger().error('webhook_core_call_error', 'error', String(sendErr))
    }

    return e.json(200, { received: true })
  } catch (err) {
    $app.logger().error('Shopify webhook error', 'error', String(err))
    return e.json(500, { error: 'Internal error' })
  }
})
