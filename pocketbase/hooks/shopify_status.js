routerAdd(
  'GET',
  '/backend/v1/shopify/status',
  (e) => {
    try {
      const token = $secrets.get('SHOPIFY_ACCESS_TOKEN') || ''
      const domain = $secrets.get('SHOPIFY_STORE_DOMAIN') || ''

      if (!token || !domain) {
        return e.json(200, {
          connected: false,
          storeDomain: domain || '',
          apiVersion: '',
          message:
            'Conexão não configurada. Configure SHOPIFY_ACCESS_TOKEN e SHOPIFY_STORE_DOMAIN nos secrets do Skip Cloud.',
        })
      }

      const apiVersion = '2024-10'
      const url = 'https://' + domain + '/admin/api/' + apiVersion + '/shop.json'

      let res
      try {
        res = $http.send({
          url: url,
          method: 'GET',
          headers: {
            'X-Shopify-Access-Token': token,
            'Content-Type': 'application/json',
          },
          timeout: 15,
        })
      } catch (err) {
        return e.json(200, {
          connected: false,
          storeDomain: domain,
          apiVersion: apiVersion,
          message: 'Falha de rede ao conectar com Shopify: ' + String(err),
        })
      }

      if (res.statusCode !== 200) {
        return e.json(200, {
          connected: false,
          storeDomain: domain,
          apiVersion: apiVersion,
          message:
            'Shopify respondeu com status ' + res.statusCode + '. Verifique o token de acesso.',
        })
      }

      let shopData = {}
      try {
        shopData = res.json
      } catch (_) {}

      let productCount = 0
      let orderCount = 0
      try {
        const prodCol = $app.findCollectionByNameOrId('products')
        const prods = $app.findRecordsByFilter('products', "shopify_id != ''", '-created', 500, 0)
        productCount = prods.length
      } catch (_) {}
      try {
        const ords = $app.findRecordsByFilter('orders', "shopify_id != ''", '-created', 500, 0)
        orderCount = ords.length
      } catch (_) {}

      return e.json(200, {
        connected: true,
        storeDomain: domain,
        apiVersion: apiVersion,
        shopName: shopData.shop ? shopData.shop.name : '',
        syncedProducts: productCount,
        syncedOrders: orderCount,
      })
    } catch (err) {
      return e.json(500, { error: 'Erro ao verificar status: ' + String(err) })
    }
  },
  $apis.requireAuth(),
)
