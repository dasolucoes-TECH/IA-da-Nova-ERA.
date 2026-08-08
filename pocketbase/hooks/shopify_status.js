routerAdd(
  'GET',
  '/backend/v1/shopify/status',
  (e) => {
    try {
      var userId = e.auth ? e.auth.id : ''
      if (!userId) return e.unauthorizedError('auth required')

      function normalizeDomain(domain) {
        if (!domain) return ''
        return domain
          .trim()
          .toLowerCase()
          .replace(/^https?:\/\//, '')
          .replace(/\/.*$/, '')
      }

      var clientId = $secrets.get('SHOPIFY_CLIENT_ID') || ''
      var clientSecret = $secrets.get('SHOPIFY_CLIENT_SECRET') || ''
      var secretDomain = $secrets.get('SHOPIFY_STORE_DOMAIN') || ''
      var apiVersion = $secrets.get('SHOPIFY_API_VERSION') || ''
      var configured =
        clientId !== '' && clientSecret !== '' && secretDomain !== '' && apiVersion !== ''

      var storeRecord = null
      try {
        var stores = $app.findRecordsByFilter('stores', "id != ''", 'created', 1, 0)
        if (stores.length > 0) storeRecord = stores[0]
      } catch (_) {}

      if (!configured) {
        return e.json(200, {
          connected: false,
          status: 'NOT_CONFIGURED',
          storeDomain: normalizeDomain(secretDomain),
          apiVersion: apiVersion,
          shopName: storeRecord
            ? storeRecord.getString('shopify_shop_name') || storeRecord.getString('name') || ''
            : '',
          message:
            'Shopify credentials not fully configured. Set SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET, SHOPIFY_STORE_DOMAIN, and SHOPIFY_API_VERSION in Skip Cloud Secrets.',
        })
      }

      var cleanDomain = normalizeDomain(secretDomain)

      var cachedToken = storeRecord ? storeRecord.getString('cached_token') : ''
      var expiresAtStr = storeRecord ? storeRecord.getString('token_expires_at') : ''
      var token = ''
      var now = new Date()
      var fiveMinLater = new Date(now.getTime() + 5 * 60 * 1000)

      if (cachedToken && expiresAtStr) {
        try {
          if (new Date(expiresAtStr) > fiveMinLater) token = cachedToken
        } catch (_) {}
      }

      if (!token) {
        var tokenRes = $http.send({
          url: 'https://' + cleanDomain + '/admin/oauth/access_token',
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
          },
          body:
            'grant_type=client_credentials&client_id=' +
            encodeURIComponent(clientId) +
            '&client_secret=' +
            encodeURIComponent(clientSecret),
          timeout: 15,
        })

        if (tokenRes.statusCode !== 200) {
          return e.json(200, {
            connected: false,
            status: 'AUTH_ERROR',
            storeDomain: cleanDomain,
            apiVersion: apiVersion,
            shopName: storeRecord ? storeRecord.getString('shopify_shop_name') || '' : '',
            message:
              'Token request failed (HTTP ' +
              tokenRes.statusCode +
              '). Verify SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET.',
          })
        }

        var tokenData = tokenRes.json
        if (!tokenData.access_token) {
          return e.json(200, {
            connected: false,
            status: 'AUTH_ERROR',
            storeDomain: cleanDomain,
            apiVersion: apiVersion,
            shopName: storeRecord ? storeRecord.getString('shopify_shop_name') || '' : '',
            message: 'No access_token received from Shopify.',
          })
        }

        token = tokenData.access_token
        var expiresIn = tokenData.expires_in || 3600
        var expiry = new Date(now.getTime() + expiresIn * 1000)

        if (storeRecord) {
          storeRecord.set('cached_token', token)
          storeRecord.set('token_expires_at', expiry.toISOString())
          if (tokenData.scope) storeRecord.set('cached_scopes', tokenData.scope)
          try {
            $app.save(storeRecord)
          } catch (_) {}
        }
      }

      var apiOk = false
      var shopData = null
      try {
        var query = 'query { shop { id name myshopifyDomain } }'
        var res = $http.send({
          url: 'https://' + cleanDomain + '/admin/api/' + apiVersion + '/graphql.json',
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
          body: JSON.stringify({ query: query }),
          timeout: 15,
        })

        if (
          res.statusCode === 200 &&
          res.json &&
          !res.json.errors &&
          res.json.data &&
          res.json.data.shop
        ) {
          apiOk = true
          shopData = res.json.data.shop
        } else if (
          res.statusCode === 403 ||
          (res.json &&
            res.json.errors &&
            JSON.stringify(res.json.errors).indexOf('ACCESS_DENIED') !== -1)
        ) {
          return e.json(200, {
            connected: false,
            status: 'PERMISSION_ERROR',
            storeDomain: cleanDomain,
            apiVersion: apiVersion,
            shopName: storeRecord ? storeRecord.getString('shopify_shop_name') || '' : '',
            message: 'Shopify returned ACCESS_DENIED. Check app permissions/scopes.',
          })
        }
      } catch (err) {
        $app.logger().warn('shopify status GraphQL check failed', 'error', String(err))
      }

      if (!apiOk) {
        return e.json(200, {
          connected: false,
          status: 'API_ERROR',
          storeDomain: cleanDomain,
          apiVersion: apiVersion,
          shopName: storeRecord ? storeRecord.getString('shopify_shop_name') || '' : '',
          message: 'Shopify API unreachable after token acquisition.',
        })
      }

      if (storeRecord) {
        storeRecord.set('connected', true)
        if (shopData && shopData.name) storeRecord.set('shopify_shop_name', shopData.name)
        if (shopData && shopData.myshopifyDomain)
          storeRecord.set('myshopify_domain', shopData.myshopifyDomain)
        storeRecord.set('api_version', apiVersion)
        try {
          $app.save(storeRecord)
        } catch (_) {}
      }

      return e.json(200, {
        connected: true,
        status: 'CONNECTED',
        storeDomain: cleanDomain,
        apiVersion: apiVersion,
        shopName:
          (shopData && shopData.name) ||
          (storeRecord ? storeRecord.getString('shopify_shop_name') : '') ||
          '',
        domain: (shopData && shopData.myshopifyDomain) || cleanDomain,
        myshopifyDomain:
          (shopData && shopData.myshopifyDomain) ||
          (storeRecord ? storeRecord.getString('myshopify_domain') : '') ||
          cleanDomain,
        lastProductSync: storeRecord ? storeRecord.getString('last_product_sync') || '' : '',
        lastOrderSync: storeRecord ? storeRecord.getString('last_order_sync') || '' : '',
        verifiedAt: new Date().toISOString(),
      })
    } catch (err) {
      return e.json(500, { error: 'Status check failed: ' + String(err) })
    }
  },
  $apis.requireAuth(),
)
