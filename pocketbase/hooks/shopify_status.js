routerAdd(
  'GET',
  '/backend/v1/shopify/status',
  (e) => {
    try {
      const token = $secrets.get('SHOPIFY_ACCESS_TOKEN') || ''
      const domain = $secrets.get('SHOPIFY_STORE_DOMAIN') || ''

      if (!token && !domain) {
        return e.json(200, {
          connected: false,
          storeDomain: '',
          apiVersion: '',
          message:
            'SHOPIFY_ACCESS_TOKEN e SHOPIFY_STORE_DOMAIN não configurados. Acesse os secrets do Skip Cloud e configure ambos os valores.',
        })
      }

      if (!token) {
        return e.json(200, {
          connected: false,
          storeDomain: domain,
          apiVersion: '',
          message:
            'SHOPIFY_ACCESS_TOKEN está vazio. Gere um token no painel de Custom Apps da Shopify (deve começar com shpat_).',
        })
      }

      if (!domain) {
        return e.json(200, {
          connected: false,
          storeDomain: '',
          apiVersion: '',
          message:
            'SHOPIFY_STORE_DOMAIN está vazio. Informe o domínio da loja no formato sualoja.myshopify.com (sem https:// ou /admin).',
        })
      }

      if (!token.startsWith('shpat_')) {
        return e.json(200, {
          connected: false,
          storeDomain: domain,
          apiVersion: '',
          message:
            'SHOPIFY_ACCESS_TOKEN inválido. O token de acesso Admin API deve começar com "shpat_". Acesse a aba Secrets no painel do Skip Cloud, atualize o secret SHOPIFY_ACCESS_TOKEN com um token válido (gerado no painel de Custom Apps da Shopify) e clique novamente em "Verificar Conexão". Tokens do tipo shpss_ (partner app secret) não são mais suportados.',
        })
      }

      var cleanDomain = domain.trim().toLowerCase()
      cleanDomain = cleanDomain.replace(/^https?:\/\//, '').replace(/\/.*$/, '')

      if (!cleanDomain.match(/^[a-z0-9][a-z0-9\-]*\.myshopify\.com$/)) {
        return e.json(200, {
          connected: false,
          storeDomain: domain,
          apiVersion: '',
          message:
            'SHOPIFY_STORE_DOMAIN inválido. Use o formato "sualoja.myshopify.com" sem https://, barras ou /admin.',
        })
      }

      const apiVersion = $secrets.get('SHOPIFY_API_VERSION') || '2024-10'
      const url = 'https://' + cleanDomain + '/admin/api/' + apiVersion + '/shop.json'

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
          storeDomain: cleanDomain,
          apiVersion: apiVersion,
          message:
            'Falha de rede ao conectar com a Shopify. Verifique se o domínio "' +
            cleanDomain +
            '" está correto e se há conectividade. Erro: ' +
            String(err),
        })
      }

      if (res.statusCode === 401 || res.statusCode === 403) {
        let hint = 'Token de acesso recusado pela Shopify (HTTP ' + res.statusCode + ').'
        hint +=
          ' Gere um novo token no painel de Custom Apps e certifique-se de conceder as permissões: read_products, write_products, read_orders, write_orders, read_inventory, write_inventory.'
        return e.json(200, {
          connected: false,
          storeDomain: cleanDomain,
          apiVersion: apiVersion,
          message: hint,
        })
      }

      if (res.statusCode === 404) {
        return e.json(200, {
          connected: false,
          storeDomain: cleanDomain,
          apiVersion: apiVersion,
          message:
            'Loja não encontrada na Shopify (HTTP 404). Verifique se o domínio "' +
            cleanDomain +
            '" corresponde a uma loja ativa.',
        })
      }

      if (res.statusCode === 429) {
        return e.json(200, {
          connected: false,
          storeDomain: cleanDomain,
          apiVersion: apiVersion,
          message:
            'Limite de taxa da Shopify atingido (HTTP 429). Aguarde alguns instantes e tente novamente.',
        })
      }

      if (res.statusCode !== 200) {
        return e.json(200, {
          connected: false,
          storeDomain: cleanDomain,
          apiVersion: apiVersion,
          message:
            'Shopify respondeu com status ' +
            res.statusCode +
            '. Verifique o token de acesso e as permissões do Custom App.',
        })
      }

      let shopData = {}
      try {
        shopData = res.json
      } catch (_) {}

      let productCount = 0
      let orderCount = 0
      let lastProductSync = ''
      let lastOrderSync = ''
      try {
        const prods = $app.findRecordsByFilter('products', "shopify_id != ''", '-created', 500, 0)
        productCount = prods.length
        if (prods.length > 0 && prods[0].getString('updated')) {
          lastProductSync = prods[0].getString('updated')
        }
      } catch (_) {}
      try {
        const ords = $app.findRecordsByFilter('orders', "shopify_id != ''", '-created', 500, 0)
        orderCount = ords.length
        if (ords.length > 0 && ords[0].getString('updated')) {
          lastOrderSync = ords[0].getString('updated')
        }
      } catch (_) {}

      return e.json(200, {
        connected: true,
        storeDomain: cleanDomain,
        apiVersion: apiVersion,
        shopName: shopData.shop ? shopData.shop.name : '',
        shopEmail: shopData.shop ? shopData.shop.email || '' : '',
        shopCurrency: shopData.shop ? shopData.shop.currency || '' : '',
        syncedProducts: productCount,
        syncedOrders: orderCount,
        lastProductSync: lastProductSync,
        lastOrderSync: lastOrderSync,
      })
    } catch (err) {
      return e.json(500, { error: 'Erro ao verificar status: ' + String(err) })
    }
  },
  $apis.requireAuth(),
)
