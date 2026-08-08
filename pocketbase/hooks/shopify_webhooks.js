routerAdd('POST', '/backend/v1/shopify/webhook', (e) => {
  try {
    var rawBody = e.request.body
    var hmacHeader = e.request.header.get('X-Shopify-Hmac-Sha256') || ''
    var clientId = $secrets.get('SHOPIFY_CLIENT_ID') || ''
    var clientSecret = $secrets.get('SHOPIFY_CLIENT_SECRET') || ''

    if (!clientSecret) {
      return e.json(401, { error: 'Webhook secret não configurado' })
    }

    var computedHmac = $security.hs256(rawBody, clientSecret)

    if (computedHmac !== hmacHeader) {
      $app.logger().warn('Shopify webhook HMAC inválido', 'ip', e.request.remoteAddr)
      return e.json(401, { error: 'HMAC inválido' })
    }

    var topic = e.request.header.get('X-Shopify-Topic') || ''
    var body = e.requestInfo().body || {}

    $app.logger().info('Shopify webhook recebido', 'topic', topic, 'id', body.id || '')

    if (topic === 'app/uninstalled') {
      var storeRecord = $app.__shopifyGetStore()
      if (storeRecord) {
        storeRecord.set('connected', false)
        $app.save(storeRecord)
      }
      return e.json(200, { received: true })
    }

    if (topic.indexOf('products/') !== -1) {
      return e.json(200, {
        received: true,
        message: 'Use POST /backend/v1/shopify/sync-products para sincronizar',
      })
    }

    if (topic.indexOf('orders/') !== -1) {
      return e.json(200, {
        received: true,
        message: 'Use POST /backend/v1/shopify/sync-orders para sincronizar',
      })
    }

    return e.json(200, { received: true })
  } catch (err) {
    $app.logger().error('Erro no webhook Shopify', 'error', String(err))
    return e.json(500, { error: 'Erro interno' })
  }
})
