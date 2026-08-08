routerAdd(
  'POST',
  '/backend/v1/shopify/sync-orders',
  (e) => {
    try {
      var clientId = $secrets.get('SHOPIFY_CLIENT_ID') || ''
      var clientSecret = $secrets.get('SHOPIFY_CLIENT_SECRET') || ''
      var domain = $secrets.get('SHOPIFY_STORE_DOMAIN') || ''
      var apiVersion = $secrets.get('SHOPIFY_API_VERSION') || '2024-10'

      if (!clientId) {
        return e.json(400, { error: 'SHOPIFY_CLIENT_ID não configurado.' })
      }
      if (!clientSecret) {
        return e.json(400, { error: 'SHOPIFY_CLIENT_SECRET não configurado.' })
      }
      if (!domain) {
        return e.json(400, { error: 'SHOPIFY_STORE_DOMAIN não configurado.' })
      }

      var cleanDomain = domain
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, '')
        .replace(/\/.*$/, '')

      if (!cleanDomain.match(/^[a-z0-9][a-z0-9\-]*\.myshopify\.com$/)) {
        return e.json(400, {
          error: 'Use o domínio interno da Shopify no formato nomedaloja.myshopify.com.',
        })
      }

      function getAccessToken() {
        var tokenRes = $http.send({
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
        if (tokenRes.statusCode === 401) {
          throw new Error('Client ID ou Client Secret inválido.')
        }
        if (tokenRes.statusCode === 403) {
          throw new Error(
            'O aplicativo não possui permissão suficiente ou não está instalado corretamente na loja.',
          )
        }
        if (tokenRes.statusCode !== 200) {
          throw new Error(
            'Shopify respondeu com status ' + tokenRes.statusCode + ' ao gerar token.',
          )
        }
        var td = tokenRes.json
        if (!td.access_token) {
          throw new Error('Token de acesso não recebido da Shopify.')
        }
        return td.access_token
      }

      function runGraphQL(query, variables, token) {
        var res = $http.send({
          url: 'https://' + cleanDomain + '/admin/api/' + apiVersion + '/graphql.json',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': token,
          },
          body: JSON.stringify({ query: query, variables: variables || {} }),
          timeout: 30,
        })
        return res
      }

      var accessToken
      try {
        accessToken = getAccessToken()
      } catch (err) {
        return e.json(400, { error: String(err) })
      }

      var ordersQuery =
        'query SyncOrders { orders(first: 50) { edges { node { id name displayFulfillmentStatus displayFinancialStatus totalPrice email createdAt updatedAt customer { firstName lastName } lineItems(first: 50) { edges { node { name quantity originalUnitPrice } } } } } } }'

      var graphQLRes
      try {
        graphQLRes = runGraphQL(ordersQuery, {}, accessToken)
      } catch (err) {
        return e.json(502, {
          error: 'Falha de rede ao buscar pedidos: ' + String(err),
        })
      }

      if (graphQLRes.statusCode === 401) {
        try {
          accessToken = getAccessToken()
          graphQLRes = runGraphQL(ordersQuery, {}, accessToken)
        } catch (retryErr) {
          return e.json(401, {
            error: 'Token renovado mas falha persiste: ' + String(retryErr),
          })
        }
      }

      if (graphQLRes.statusCode !== 200) {
        return e.json(graphQLRes.statusCode, {
          error: 'Shopify retornou status ' + graphQLRes.statusCode + ' ao buscar pedidos.',
        })
      }

      var body
      try {
        body = graphQLRes.json
      } catch (_) {
        return e.json(500, { error: 'Resposta inválida do Shopify.' })
      }

      if (body.errors) {
        var errStr = JSON.stringify(body.errors)
        if (errStr.indexOf('ACCESS_DENIED') !== -1) {
          return e.json(200, {
            created: 0,
            updated: 0,
            total: 0,
            errors: [],
            status: 'permission_required',
            message:
              'A permissão read_orders não foi autorizada na Shopify. Acesse o painel de Custom Apps e approve o escopo read_orders para sincronizar pedidos.',
          })
        }
        return e.json(400, { error: 'Erro GraphQL: ' + errStr })
      }

      var edges = body.data && body.data.orders ? body.data.orders.edges : []
      var created = 0
      var updated = 0
      var errors = []

      var orderCol = $app.findCollectionByNameOrId('orders')

      for (var i = 0; i < edges.length; i++) {
        var so = edges[i].node
        var shopifyId = so.id
        var existing = null
        try {
          existing = $app.findFirstRecordByData('orders', 'shopify_id', shopifyId)
        } catch (_) {}

        var financialStatus = so.displayFinancialStatus || ''
        var mappedStatus = 'pending'
        if (financialStatus === 'PAID') {
          mappedStatus = 'paid'
        } else if (financialStatus === 'REFUNDED' || financialStatus === 'VOIDED') {
          mappedStatus = 'cancelled'
        }

        var fulfillmentStatus = so.displayFulfillmentStatus || ''
        if (fulfillmentStatus === 'FULFILLED' && mappedStatus === 'paid') {
          mappedStatus = 'delivered'
        } else if (fulfillmentStatus === 'PARTIALLY_FULFILLED' && mappedStatus !== 'cancelled') {
          mappedStatus = 'shipped'
        }

        var lineItemEdges = so.lineItems && so.lineItems.edges ? so.lineItems.edges : []
        var items = []
        for (var j = 0; j < lineItemEdges.length; j++) {
          var li = lineItemEdges[j].node
          items.push({
            product_name: li.name || '',
            quantity: li.quantity || 1,
            price: parseFloat(li.originalUnitPrice) || 0,
          })
        }

        var customerName = ''
        if (so.customer) {
          customerName = ((so.customer.firstName || '') + ' ' + (so.customer.lastName || '')).trim()
        }
        var orderNumber = so.name || ''

        if (existing) {
          existing.set('order_number', orderNumber || existing.getString('order_number'))
          existing.set('customer_name', customerName || existing.getString('customer_name'))
          existing.set('customer_email', so.email || existing.getString('customer_email'))
          existing.set('total', parseFloat(so.totalPrice) || 0)
          existing.set('status', mappedStatus)
          existing.set('items', JSON.stringify(items))
          existing.set('source', 'shopify')
          try {
            $app.save(existing)
            updated++
          } catch (saveErr) {
            errors.push({ order: so.name, error: String(saveErr) })
          }
        } else {
          try {
            var rec = new Record(orderCol)
            rec.set('order_number', orderNumber)
            rec.set('customer_name', customerName)
            rec.set('customer_email', so.email || '')
            rec.set('total', parseFloat(so.totalPrice) || 0)
            rec.set('status', mappedStatus)
            rec.set('items', JSON.stringify(items))
            rec.set('source', 'shopify')
            rec.set('shopify_id', shopifyId)
            $app.save(rec)
            created++
          } catch (saveErr) {
            errors.push({ order: so.name, error: String(saveErr) })
          }
        }
      }

      return e.json(200, {
        created: created,
        updated: updated,
        total: edges.length,
        errors: errors,
        status: 'success',
      })
    } catch (err) {
      return e.json(500, {
        error: 'Erro na sincronização de pedidos: ' + String(err),
      })
    }
  },
  $apis.requireAuth(),
)
