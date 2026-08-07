routerAdd(
  'POST',
  '/backend/v1/shopify/sync-orders',
  (e) => {
    try {
      const token = $secrets.get('SHOPIFY_ACCESS_TOKEN') || ''
      const domain = $secrets.get('SHOPIFY_STORE_DOMAIN') || ''

      if (!token || !domain) {
        return e.json(400, {
          error:
            'Conexão não configurada. Defina SHOPIFY_ACCESS_TOKEN (começando com shpat_) e SHOPIFY_STORE_DOMAIN (formato sualoja.myshopify.com) nos secrets do Skip Cloud.',
        })
      }

      if (!token.startsWith('shpat_')) {
        return e.json(400, {
          error:
            'SHOPIFY_ACCESS_TOKEN inválido. O token de acesso Admin API deve começar com "shpat_". Atualize o secret SHOPIFY_ACCESS_TOKEN na aba Secrets do Skip Cloud com um token válido. Tokens do tipo shpss_ (partner app secret) não são mais suportados.',
        })
      }

      var cleanDomain = domain
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, '')
        .replace(/\/.*$/, '')

      if (!cleanDomain.match(/^[a-z0-9][a-z0-9\-]*\.myshopify\.com$/)) {
        return e.json(400, {
          error:
            'SHOPIFY_STORE_DOMAIN inválido. Use o formato "sualoja.myshopify.com" sem https:// ou /admin.',
        })
      }

      const apiVersion = $secrets.get('SHOPIFY_API_VERSION') || '2024-10'
      const url =
        'https://' + cleanDomain + '/admin/api/' + apiVersion + '/orders.json?limit=250&status=any'

      let res
      try {
        res = $http.send({
          url: url,
          method: 'GET',
          headers: {
            'X-Shopify-Access-Token': token,
            'Content-Type': 'application/json',
          },
          timeout: 30,
        })
      } catch (err) {
        return e.json(502, {
          error:
            'Falha de rede ao buscar pedidos da Shopify. Verifique conectividade e o domínio "' +
            cleanDomain +
            '". Erro: ' +
            String(err),
        })
      }

      if (res.statusCode === 401 || res.statusCode === 403) {
        return e.json(res.statusCode, {
          error:
            'Token recusado pela Shopify (HTTP ' +
            res.statusCode +
            '). Certifique-se de que o Custom App tem a permissão read_orders.',
        })
      }

      if (res.statusCode !== 200) {
        return e.json(res.statusCode, {
          error: 'Shopify retornou status ' + res.statusCode + ' ao buscar pedidos.',
        })
      }

      let body
      try {
        body = res.json
      } catch (_) {
        return e.json(500, {
          error: 'Resposta inválida do Shopify — não foi possível decodificar o JSON.',
        })
      }

      const orders = body.orders || []
      let created = 0
      let updated = 0
      let errors = []

      const orderCol = $app.findCollectionByNameOrId('orders')

      for (const so of orders) {
        const shopifyId = String(so.id)
        let existing = null
        try {
          existing = $app.findFirstRecordByData('orders', 'shopify_id', shopifyId)
        } catch (_) {}

        const financialStatus = so.financial_status || ''
        let mappedStatus = 'pending'
        if (financialStatus === 'paid') {
          mappedStatus = 'paid'
        } else if (financialStatus === 'pending' || financialStatus === 'authorized') {
          mappedStatus = 'pending'
        } else if (financialStatus === 'refunded' || financialStatus === 'voided') {
          mappedStatus = 'cancelled'
        }

        const fulfillmentStatus = so.fulfillment_status
        if (fulfillmentStatus === 'fulfilled' && mappedStatus === 'paid') {
          mappedStatus = 'delivered'
        } else if (fulfillmentStatus === 'partial' && mappedStatus !== 'cancelled') {
          mappedStatus = 'shipped'
        }

        const items = (so.line_items || []).map(function (li) {
          return {
            product_name: li.name || li.title || '',
            quantity: li.quantity || 1,
            price: parseFloat(li.price) || 0,
          }
        })

        const customerName = so.customer
          ? (so.customer.first_name + ' ' + so.customer.last_name).trim()
          : ''
        const orderNumber = so.name || '#' + so.id

        if (existing) {
          existing.set('order_number', orderNumber || existing.getString('order_number'))
          existing.set('customer_name', customerName || existing.getString('customer_name'))
          existing.set('customer_email', so.email || existing.getString('customer_email'))
          existing.set('total', parseFloat(so.total_price) || 0)
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
            const rec = new Record(orderCol)
            rec.set('order_number', orderNumber)
            rec.set('customer_name', customerName)
            rec.set('customer_email', so.email || '')
            rec.set('total', parseFloat(so.total_price) || 0)
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
        total: orders.length,
        errors: errors,
      })
    } catch (err) {
      return e.json(500, { error: 'Erro na sincronização de pedidos: ' + String(err) })
    }
  },
  $apis.requireAuth(),
)
