routerAdd(
  'POST',
  '/backend/v1/shopify/diagnostics',
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

      var diag = { steps: [], summary: '' }

      var clientId = $secrets.get('SHOPIFY_CLIENT_ID') || ''
      var clientSecret = $secrets.get('SHOPIFY_CLIENT_SECRET') || ''
      var secretDomain = $secrets.get('SHOPIFY_STORE_DOMAIN') || ''
      var apiVersion = $secrets.get('SHOPIFY_API_VERSION') || ''

      diag.steps.push({
        step: 1,
        name: 'secrets_check',
        SHOPIFY_CLIENT_ID: clientId ? 'PRESENT' : 'MISSING',
        SHOPIFY_CLIENT_SECRET: clientSecret ? 'PRESENT' : 'MISSING',
        SHOPIFY_STORE_DOMAIN: secretDomain ? 'PRESENT' : 'MISSING',
        SHOPIFY_API_VERSION: apiVersion ? 'PRESENT' : 'MISSING',
      })

      var cleanDomain = normalizeDomain(secretDomain)
      var domainOk = cleanDomain.indexOf('.myshopify.com') !== -1
      diag.steps.push({
        step: 2,
        name: 'domain_normalization',
        domain: cleanDomain,
        endsWith_myshopify_com: domainOk,
      })

      if (!clientId || !clientSecret || !secretDomain || !apiVersion) {
        diag.summary = 'FAIL: One or more secrets are MISSING'
        return e.json(200, diag)
      }

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

      var tokenReceived =
        tokenRes.statusCode === 200 && tokenRes.json && tokenRes.json.access_token ? 'YES' : 'NO'
      diag.steps.push({
        step: 3,
        name: 'token_request',
        httpStatus: tokenRes.statusCode,
        access_token_received: tokenReceived,
        expires_in: tokenRes.json ? tokenRes.json.expires_in : null,
        scope: tokenRes.json ? tokenRes.json.scope : null,
      })

      if (tokenReceived !== 'YES') {
        diag.summary = 'FAIL: Token request failed (HTTP ' + tokenRes.statusCode + ')'
        return e.json(200, diag)
      }

      var accessToken = tokenRes.json.access_token
      var shopRes = $http.send({
        url: 'https://' + cleanDomain + '/admin/api/' + apiVersion + '/graphql.json',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': accessToken },
        body: JSON.stringify({ query: 'query { shop { id name myshopifyDomain } }' }),
        timeout: 15,
      })

      var shopName = null
      var gqlErrors = null
      if (shopRes.statusCode === 200 && shopRes.json) {
        if (shopRes.json.errors) gqlErrors = JSON.stringify(shopRes.json.errors)
        if (shopRes.json.data && shopRes.json.data.shop) shopName = shopRes.json.data.shop.name
      }
      diag.steps.push({
        step: 4,
        name: 'graphql_shop_query',
        httpStatus: shopRes.statusCode,
        shop_name: shopName,
        graphql_errors: gqlErrors,
      })

      var storeRecord = null
      var memberRecord = null
      try {
        var stores = $app.findRecordsByFilter('stores', "id != ''", 'created', 1, 0)
        if (stores.length > 0) storeRecord = stores[0]
      } catch (_) {}

      try {
        memberRecord = $app.findFirstRecordByFilter('store_members', 'user = {:uid}', {
          uid: userId,
        })
      } catch (_) {}

      diag.steps.push({
        step: 5,
        name: 'tenant_membership',
        user_id: userId,
        store_member_found: !!memberRecord,
        store_id: storeRecord ? storeRecord.id : null,
        store_name: storeRecord ? storeRecord.getString('name') : null,
        role: memberRecord ? memberRecord.getString('role') : null,
      })

      diag.steps.push({
        step: 6,
        name: 'runtime_helper_availability',
        normalizeDomain: typeof normalizeDomain === 'function',
        secrets_accessible: typeof $secrets !== 'undefined' && typeof $secrets.get === 'function',
        http_send_available: typeof $http !== 'undefined',
      })

      var first5 = null
      try {
        var prodRes = $http.send({
          url: 'https://' + cleanDomain + '/admin/api/' + apiVersion + '/graphql.json',
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': accessToken },
          body: JSON.stringify({
            query: 'query { products(first: 5) { edges { node { id title handle status } } } }',
          }),
          timeout: 15,
        })
        if (
          prodRes.statusCode === 200 &&
          prodRes.json &&
          prodRes.json.data &&
          prodRes.json.data.products
        ) {
          first5 = prodRes.json.data.products.edges.map(function (edge) {
            return {
              id: edge.node.id,
              title: edge.node.title,
              handle: edge.node.handle,
              status: edge.node.status,
            }
          })
        }
      } catch (_) {}
      diag.steps.push({ step: 7, name: 'first_5_products', products: first5 })

      diag.summary = shopName
        ? 'CONNECTED: ' + shopName
        : 'FAIL: shop query did not return shop name'
      return e.json(200, diag)
    } catch (err) {
      return e.json(500, { error: 'Diagnostics failed: ' + String(err) })
    }
  },
  $apis.requireAuth(),
)
