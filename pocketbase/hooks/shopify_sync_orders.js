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
            'Conexão não configurada. Configure SHOPIFY_ACCESS_TOKEN e SHOPIFY_STORE_DOMAIN nos secrets do Skip Cloud.',
        })
      }

      const apiVersion = '2024-10'
      const url =
        'https://' + domain + '/admin/api/' + apiVersion + '/orders.json?limit=250&status=any'

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
        return e.json(502, { error: 'Falha de rede ao buscar pedidos: ' + String(err) })
      }

      if (res.statusCode !== 200) {
        return e.json(res.statusCode, { error: 'Shopify retornou status ' + res.statusCode })
      }

      let body
      try {
        body = res.json
      } catch (_) {
        return e.json(500, { error: 'Resposta inválida do Shopify' })
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

        if (existing) {
          existing.set('order_number', so.name || existing.getString('order_number'))
          existing.set(
            'customer_name',
            so.customer
              ? (so.customer.first_name + ' ' + so.customer.last_name).trim()
              : existing.getString('customer_name'),
          )
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
            rec.set('order_number', so.name || '#' + so.id)
            rec.set(
              'customer_name',
              so.customer ? (so.customer.first_name + ' ' + so.customer.last_name).trim() : '',
            )
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
