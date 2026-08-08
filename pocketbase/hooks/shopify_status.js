routerAdd(
  'GET',
  '/backend/v1/shopify/status',
  (e) => {
    try {
      const clientId = $secrets.get('SHOPIFY_CLIENT_ID') || ''
      const clientSecret = $secrets.get('SHOPIFY_CLIENT_SECRET') || ''
      const domain = $secrets.get('SHOPIFY_STORE_DOMAIN') || ''
      const apiVersion = $secrets.get('SHOPIFY_API_VERSION') || '2024-10'

      if (!clientId) {
        return e.json(200, {
          connected: false,
          status: 'NOT_CONFIGURED',
          storeDomain: '',
          apiVersion: '',
          message: 'SHOPIFY_CLIENT_ID não configurado.',
        })
      }
      if (!clientSecret) {
        return e.json(200, {
          connected: false,
          status: 'NOT_CONFIGURED',
          storeDomain: '',
          apiVersion: '',
          message: 'SHOPIFY_CLIENT_SECRET não configurado.',
        })
      }
      if (!domain) {
        return e.json(200, {
          connected: false,
          status: 'NOT_CONFIGURED',
          storeDomain: '',
          apiVersion: '',
          message: 'SHOPIFY_STORE_DOMAIN não configurado.',
        })
      }

      var cleanDomain = domain
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, '')
        .replace(/\/.*$/, '')

      if (!cleanDomain.match(/^[a-z0-9][a-z0-9\-]*\.myshopify\.com$/)) {
        return e.json(200, {
          connected: false,
          status: 'NOT_CONFIGURED',
          storeDomain: domain,
          apiVersion: '',
          message: 'Use o domínio interno da Shopify no formato nomedaloja.myshopify.com.',
        })
      }

      var tokenRes
      try {
        tokenRes = $http.send({
          url: 'https://' + cleanDomain + '/admin/oauth/access_token',
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
          },
          body:
            'grant_type=client_credentials&client_id=' +
            clientId +
            '&client_secret=' +
            clientSecret,
          timeout: 15,
        })
      } catch (err) {
        return e.json(200, {
          connected: false,
          status: 'API_ERROR',
          storeDomain: cleanDomain,
          apiVersion: apiVersion,
          message:
            'Falha de rede ao conectar com a Shopify. Verifique o domínio e a conectividade. Erro: ' +
            String(err),
        })
      }

      if (tokenRes.statusCode === 401) {
        return e.json(200, {
          connected: false,
          status: 'AUTH_ERROR',
          storeDomain: cleanDomain,
          apiVersion: apiVersion,
          message: 'Client ID ou Client Secret inválido.',
        })
      }
      if (tokenRes.statusCode === 403) {
        return e.json(200, {
          connected: false,
          status: 'AUTH_ERROR',
          storeDomain: cleanDomain,
          apiVersion: apiVersion,
          message:
            'O aplicativo não possui permissão suficiente ou não está instalado corretamente na loja.',
        })
      }
      if (tokenRes.statusCode !== 200) {
        return e.json(200, {
          connected: false,
          status: 'API_ERROR',
          storeDomain: cleanDomain,
          apiVersion: apiVersion,
          message:
            'Shopify respondeu com status ' + tokenRes.statusCode + ' ao gerar token de acesso.',
        })
      }

      var tokenData
      try {
        tokenData = tokenRes.json
      } catch (_) {
        return e.json(200, {
          connected: false,
          status: 'API_ERROR',
          storeDomain: cleanDomain,
          apiVersion: apiVersion,
          message: 'Resposta inválida do Shopify ao gerar token.',
        })
      }

      var accessToken = tokenData.access_token || ''
      if (!accessToken) {
        return e.json(200, {
          connected: false,
          status: 'API_ERROR',
          storeDomain: cleanDomain,
          apiVersion: apiVersion,
          message: 'Token de acesso não recebido da Shopify.',
        })
      }

      var query = 'query { shop { name myshopifyDomain primaryDomain { url } } }'

      var graphQLRes
      try {
        graphQLRes = $http.send({
          url: 'https://' + cleanDomain + '/admin/api/' + apiVersion + '/graphql.json',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': accessToken,
          },
          body: JSON.stringify({ query: query }),
          timeout: 15,
        })
      } catch (err) {
        return e.json(200, {
          connected: false,
          status: 'API_ERROR',
          storeDomain: cleanDomain,
          apiVersion: apiVersion,
          message: 'Falha de rede ao consultar a loja na Shopify. Erro: ' + String(err),
        })
      }

      if (graphQLRes.statusCode === 401) {
        return e.json(200, {
          connected: false,
          status: 'AUTH_ERROR',
          storeDomain: cleanDomain,
          apiVersion: apiVersion,
          message:
            'Token de acesso recusado pela Shopify (HTTP 401). Verifique se o aplicativo está instalado corretamente.',
        })
      }

      if (graphQLRes.statusCode !== 200) {
        return e.json(200, {
          connected: false,
          status: 'API_ERROR',
          storeDomain: cleanDomain,
          apiVersion: apiVersion,
          message:
            'Shopify respondeu com status ' + graphQLRes.statusCode + ' ao consultar a loja.',
        })
      }

      var graphQLData
      try {
        graphQLData = graphQLRes.json
      } catch (_) {
        return e.json(200, {
          connected: false,
          status: 'API_ERROR',
          storeDomain: cleanDomain,
          apiVersion: apiVersion,
          message: 'Resposta inválida do Shopify ao consultar a loja.',
        })
      }

      if (graphQLData.errors) {
        var errStr = JSON.stringify(graphQLData.errors)
        if (errStr.indexOf('ACCESS_DENIED') !== -1) {
          return e.json(200, {
            connected: false,
            status: 'PERMISSION_ERROR',
            storeDomain: cleanDomain,
            apiVersion: apiVersion,
            message: 'Escopo Shopify insuficiente para essa operação.',
          })
        }
        return e.json(200, {
          connected: false,
          status: 'API_ERROR',
          storeDomain: cleanDomain,
          apiVersion: apiVersion,
          message: 'Erro GraphQL: ' + errStr,
        })
      }

      var shop = graphQLData.data && graphQLData.data.shop ? graphQLData.data.shop : {}

      var syncedProducts = 0
      var syncedOrders = 0
      var lastProductSync = ''
      var lastOrderSync = ''
      try {
        var prods = $app.findRecordsByFilter('products', "shopify_id != ''", '-created', 500, 0)
        syncedProducts = prods.length
        if (prods.length > 0 && prods[0].getString('updated')) {
          lastProductSync = prods[0].getString('updated')
        }
      } catch (_) {}
      try {
        var ords = $app.findRecordsByFilter('orders', "shopify_id != ''", '-created', 500, 0)
        syncedOrders = ords.length
        if (ords.length > 0 && ords[0].getString('updated')) {
          lastOrderSync = ords[0].getString('updated')
        }
      } catch (_) {}

      return e.json(200, {
        connected: true,
        status: 'CONNECTED',
        storeDomain: cleanDomain,
        apiVersion: apiVersion,
        shopName: shop.name || '',
        domain: shop.primaryDomain && shop.primaryDomain.url ? shop.primaryDomain.url : '',
        myshopifyDomain: shop.myshopifyDomain || cleanDomain,
        syncedProducts: syncedProducts,
        syncedOrders: syncedOrders,
        lastProductSync: lastProductSync,
        lastOrderSync: lastOrderSync,
        verifiedAt: new Date().toISOString(),
      })
    } catch (err) {
      return e.json(500, { error: 'Erro ao verificar status: ' + String(err) })
    }
  },
  $apis.requireAuth(),
)
