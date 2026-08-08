routerAdd('POST', '/backend/v1/shopify/webhook', (e) => {
  try {
    var rawBody = e.request.body
    var hmacHeader = e.request.header.get('X-Shopify-Hmac-Sha256') || ''
    var clientSecret = $secrets.get('SHOPIFY_CLIENT_SECRET') || ''

    if (!clientSecret) {
      return e.json(401, { error: 'Webhook secret not configured' })
    }

    var computedHmac = $security.hs256(rawBody, clientSecret)

    if (computedHmac !== hmacHeader) {
      $app.logger().warn('Shopify webhook HMAC invalid', 'ip', e.request.remoteAddr)
      return e.json(401, { error: 'HMAC invalid' })
    }

    var topic = e.request.header.get('X-Shopify-Topic') || ''
    var body = e.requestInfo().body || {}

    $app.logger().info('Shopify webhook received', 'topic', topic, 'id', body.id || '')

    if (topic === 'app/uninstalled') {
      try {
        var stores = $app.findRecordsByFilter('stores', "id != ''", 'created', 1, 0)
        if (stores.length > 0) {
          stores[0].set('connected', false)
          $app.save(stores[0])
        }
      } catch (_) {}
      return e.json(200, { received: true })
    }

    if (topic.indexOf('products/') !== -1) {
      return e.json(200, {
        received: true,
        message: 'Use POST /backend/v1/shopify/sync-products to sync',
      })
    }

    if (topic.indexOf('orders/') !== -1) {
      return e.json(200, {
        received: true,
        message: 'Use POST /backend/v1/shopify/sync-orders to sync',
      })
    }

    return e.json(200, { received: true })
  } catch (err) {
    $app.logger().error('Shopify webhook error', 'error', String(err))
    return e.json(500, { error: 'Internal error' })
  }
})
