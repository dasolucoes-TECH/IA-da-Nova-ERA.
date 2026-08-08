routerAdd(
  'GET',
  '/backend/v1/shopify/status',
  (e) => {
    const userId = e.auth?.id
    if (!userId) return e.unauthorizedError('auth required')

    let storeRecord = null
    try {
      storeRecord = $app.findFirstRecordByFilter('stores', '')
    } catch (err) {
      return e.json(200, {
        connected: false,
        store_name: '',
        domain: '',
        message: 'No store configured',
      })
    }

    if (!storeRecord) {
      return e.json(200, {
        connected: false,
        store_name: '',
        domain: '',
        message: 'No store configured',
      })
    }

    const connected = storeRecord.getBool('connected')
    const myshopifyDomain = storeRecord.getString('myshopify_domain')
    const shopName = storeRecord.getString('shopify_shop_name')
    const primaryDomain = storeRecord.getString('primary_domain')
    const apiVersion = storeRecord.getString('api_version')
    const lastProductSync = storeRecord.getString('last_product_sync')
    const lastOrderSync = storeRecord.getString('last_order_sync')

    if (!connected || !myshopifyDomain) {
      return e.json(200, {
        connected: false,
        store_name: shopName,
        domain: primaryDomain || myshopifyDomain,
        message: 'Store not connected',
      })
    }

    const shopDomain = myshopifyDomain.replace(/^https?:\/\//, '').replace(/\/$/, '')
    const shopifyApiVersion = apiVersion || $os.getenv('SHOPIFY_API_VERSION') || '2024-10'
    const accessToken = $secrets.get('SHOPIFY_CLIENT_SECRET') || ''

    let shopData = null
    let apiOk = false

    if (accessToken) {
      try {
        const res = $http.send({
          url: 'https://' + shopDomain + '/admin/api/' + shopifyApiVersion + '/shop.json',
          method: 'GET',
          headers: {
            'X-Shopify-Access-Token': accessToken,
            'Content-Type': 'application/json',
          },
          timeout: 15,
        })

        if (res.statusCode === 200 && res.json && res.json.shop) {
          apiOk = true
          shopData = res.json.shop
        }
      } catch (err) {
        $app.logger().warn('shopify status check failed', 'error', String(err))
      }
    }

    return e.json(200, {
      connected: true,
      api_reachable: apiOk,
      store_name: (shopData && shopData.name) || shopName,
      domain: (shopData && shopData.domain) || primaryDomain || myshopifyDomain,
      myshopify_domain: myshopifyDomain,
      api_version: shopifyApiVersion,
      last_product_sync: lastProductSync,
      last_order_sync: lastOrderSync,
      plan: shopData ? shopData.plan_name : undefined,
      currency: shopData ? shopData.currency : undefined,
    })
  },
  $apis.requireAuth(),
)
