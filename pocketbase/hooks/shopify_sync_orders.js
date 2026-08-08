routerAdd(
  'POST',
  '/backend/v1/shopify/sync-orders',
  (e) => {
    try {
      function normalizeDomain(domain) {
        if (!domain) return ''
        return domain
          .trim()
          .toLowerCase()
          .replace(/^https?:\/\//, '')
          .replace(/\/.*$/, '')
      }

      function getConfig() {
        var clientId = $secrets.get('SHOPIFY_CLIENT_ID') || ''
        var clientSecret = $secrets.get('SHOPIFY_CLIENT_SECRET') || ''
        var domain = $secrets.get('SHOPIFY_STORE_DOMAIN') || ''
        var apiVersion = $secrets.get('SHOPIFY_API_VERSION') || ''
        return {
          clientId: clientId,
          clientSecret: clientSecret,
          domain: domain,
          apiVersion: apiVersion,
          configured: clientId !== '' && clientSecret !== '' && domain !== '' && apiVersion !== '',
        }
      }

      function getStore() {
        try {
          var stores = $app.findRecordsByFilter('stores', "id != ''", 'created', 1, 0)
          if (stores.length > 0) return stores[0]
        } catch (_) {}
        return null
      }

      function getAccessToken(storeRecord) {
        var now = new Date()
        var fiveMinLater = new Date(now.getTime() + 5 * 60 * 1000)

        if (storeRecord) {
          var cachedToken = storeRecord.getString('cached_token')
          var expiresAtStr = storeRecord.getString('token_expires_at')
          if (cachedToken && expiresAtStr) {
            try {
              var expiresAt = new Date(expiresAtStr)
              if (expiresAt > fiveMinLater) {
                return {
                  token: cachedToken,
                  fromCache: true,
                  scopes: storeRecord.getString('cached_scopes') || '',
                }
              }
            } catch (_) {}
          }
        }

        var config = getConfig()
        if (!config.configured) {
          throw new Error('Shopify não configurado')
        }

        var cleanDomain = normalizeDomain(config.domain)
        var tokenRes = $http.send({
          url: 'https://' + cleanDomain + '/admin/oauth/access_token',
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
          },
          body:
            'grant_type=client_credentials&client_id=' +
            encodeURIComponent(config.clientId) +
            '&client_secret=' +
            encodeURIComponent(config.clientSecret),
          timeout: 15,
        })

        if (tokenRes.statusCode !== 200) {
          throw new Error('Shopify respondeu status ' + tokenRes.statusCode + ' ao gerar token')
        }

        var tokenData = tokenRes.json
        if (!tokenData.access_token) {
          throw new Error('Token de acesso não recebido')
        }

        var expiresIn = tokenData.expires_in || 3600
        var expiry = new Date(now.getTime() + expiresIn * 1000)

        if (storeRecord) {
          storeRecord.set('cached_token', tokenData.access_token)
          storeRecord.set('token_expires_at', expiry.toISOString())
          if (tokenData.scope) {
            storeRecord.set('cached_scopes', tokenData.scope)
          }
          $app.save(storeRecord)
        }

        return { token: tokenData.access_token, fromCache: false, scopes: tokenData.scope || '' }
      }

      function shopifyGraphQL(query, variables, storeRecord, isRetry) {
        var config = getConfig()
        if (!config.configured) {
          throw new Error('Shopify não configurado')
        }

        var cleanDomain = normalizeDomain(config.domain)
        var tokenResult = getAccessToken(storeRecord)
        var token = tokenResult.token

        var res = $http.send({
          url: 'https://' + cleanDomain + '/admin/api/' + config.apiVersion + '/graphql.json',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': token,
          },
          body: JSON.stringify({ query: query, variables: variables || {} }),
          timeout: 30,
        })

        if (res.statusCode === 401 && !isRetry) {
          if (storeRecord) {
            storeRecord.set('cached_token', '')
            storeRecord.set('token_expires_at', '')
            $app.save(storeRecord)
          }
          return shopifyGraphQL(query, variables, storeRecord, true)
        }

        if (res.statusCode === 429) {
          throw new Error('Rate limit Shopify. Tente novamente em alguns segundos.')
        }

        return res
      }

      function parseErrors(body) {
        if (!body) return []
        var errors = []
        if (body.errors) {
          var errStr = JSON.stringify(body.errors)
          if (errStr.indexOf('ACCESS_DENIED') !== -1) {
            errors.push('Permissão Shopify insuficiente')
          } else {
            errors.push('Erro GraphQL: ' + errStr)
          }
        }
        return errors
      }

      function logSync(storeId, syncType, status, counts, errs) {
        try {
          var syncCol = $app.findCollectionByNameOrId('integration_syncs')
          var syncRec = new Record(syncCol)
          syncRec.set('store', storeId)
          syncRec.set('sync_type', syncType)
          syncRec.set('status', status)
          syncRec.set('started_at', new Date().toISOString())
          syncRec.set('completed_at', new Date().toISOString())
          syncRec.set('records_processed', counts.processed || 0)
          syncRec.set('records_created', counts.created || 0)
          syncRec.set('records_updated', counts.updated || 0)
          syncRec.set('errors', JSON.stringify(errs || []))
          $app.save(syncRec)
        } catch (_) {}
      }

      var storeRecord = getStore()
      if (!storeRecord) return e.json(400, { error: 'Nenhuma loja configurada' })

      var orderCol = $app.findCollectionByNameOrId('orders')
      var storesId = storeRecord.id

      var created = 0
      var updated = 0
      var total = 0
      var errors = []
      var hasNextPage = true
      var cursor = null

      while (hasNextPage) {
        var query =
          'query SyncOrders($cursor: String) { orders(first: 100, after: $cursor) { edges { node { id name displayFulfillmentStatus displayFinancialStatus totalPrice currencyCode createdAt updatedAt lineItems(first: 100) { edges { node { title quantity originalUnitPrice product { id } variant { id sku } } } } } } pageInfo { hasNextPage endCursor } } }'

        var graphQLRes = shopifyGraphQL(query, { cursor: cursor }, storeRecord)

        if (graphQLRes.statusCode !== 200) {
          errors.push({ error: 'Shopify status ' + graphQLRes.statusCode })
          break
        }

        var body = graphQLRes.json
        var gqlErrors = parseErrors(body)
        if (gqlErrors.length > 0) {
          if (gqlErrors[0].indexOf('Permissão') !== -1) {
            return e.json(200, {
              created: 0,
              updated: 0,
              total: 0,
              errors: [],
              status: 'permission_required',
              message: 'A permissão read_orders não foi autorizada na Shopify.',
            })
          }
          errors.push({ error: gqlErrors.join('; ') })
          break
        }

        var ordersData =
          body.data && body.data.orders
            ? body.data.orders
            : { edges: [], pageInfo: { hasNextPage: false } }
        var edges = ordersData.edges || []
        total += edges.length

        for (var i = 0; i < edges.length; i++) {
          var so = edges[i].node
          var shopifyId = so.id
          var existing = null
          try {
            existing = $app.findFirstRecordByFilter(
              'orders',
              'shopify_id = {:sid} && store = {:st}',
              { sid: shopifyId, st: storesId },
            )
          } catch (_) {}

          var items = []
          var lineItemEdges = so.lineItems && so.lineItems.edges ? so.lineItems.edges : []
          for (var j = 0; j < lineItemEdges.length; j++) {
            var li = lineItemEdges[j].node
            items.push({
              title: li.title || '',
              quantity: li.quantity || 1,
              price: parseFloat(li.originalUnitPrice) || 0,
              shopify_product_id: li.product && li.product.id ? li.product.id : '',
              shopify_variant_id: li.variant && li.variant.id ? li.variant.id : '',
              sku: li.variant && li.variant.sku ? li.variant.sku : '',
            })
          }

          var financialStatus = so.displayFinancialStatus || ''
          var fulfillmentStatus = so.displayFulfillmentStatus || ''
          var normalizedStatus = 'pending'
          if (financialStatus === 'PAID') normalizedStatus = 'paid'
          else if (financialStatus === 'REFUNDED' || financialStatus === 'VOIDED')
            normalizedStatus = 'cancelled'

          if (existing) {
            existing.set('order_number', so.name || existing.getString('order_number'))
            existing.set('total', parseFloat(so.totalPrice) || 0)
            existing.set('currency', so.currencyCode || '')
            existing.set('financial_status', financialStatus)
            existing.set('fulfillment_status', fulfillmentStatus)
            existing.set('status', normalizedStatus)
            existing.set('items', JSON.stringify(items))
            existing.set('source', 'shopify')
            existing.set('data_origin', 'shopify')
            if (so.createdAt) existing.set('created_at_shopify', so.createdAt)
            if (so.updatedAt) existing.set('updated_at_shopify', so.updatedAt)
            try {
              $app.save(existing)
              updated++
            } catch (saveErr) {
              errors.push({ order: so.name, error: String(saveErr) })
            }
          } else {
            try {
              var rec = new Record(orderCol)
              rec.set('order_number', so.name || '')
              rec.set('customer_name', '')
              rec.set('customer_email', '')
              rec.set('total', parseFloat(so.totalPrice) || 0)
              rec.set('currency', so.currencyCode || '')
              rec.set('financial_status', financialStatus)
              rec.set('fulfillment_status', fulfillmentStatus)
              rec.set('status', normalizedStatus)
              rec.set('items', JSON.stringify(items))
              rec.set('source', 'shopify')
              rec.set('shopify_id', shopifyId)
              rec.set('store', storesId)
              rec.set('data_origin', 'shopify')
              if (so.createdAt) rec.set('created_at_shopify', so.createdAt)
              if (so.updatedAt) rec.set('updated_at_shopify', so.updatedAt)
              $app.save(rec)
              created++
            } catch (saveErr) {
              errors.push({ order: so.name, error: String(saveErr) })
            }
          }
        }

        var pageInfo = ordersData.pageInfo || { hasNextPage: false }
        hasNextPage = pageInfo.hasNextPage || false
        cursor = pageInfo.endCursor || null
      }

      if (storeRecord) {
        storeRecord.set('last_order_sync', new Date().toISOString())
        $app.save(storeRecord)
      }

      logSync(
        storesId,
        'orders',
        'success',
        { processed: total, created: created, updated: updated },
        errors,
      )

      try {
        var dedupKeySync =
          'sync:ORDER_SYNC_COMPLETED:' + storesId + ':' + new Date().toISOString().substring(0, 13)
        var existingSyncEvent = null
        try {
          existingSyncEvent = $app.findFirstRecordByFilter(
            'automation_events',
            'deduplication_key = {:dk}',
            { dk: dedupKeySync },
          )
        } catch (_) {}
        if (!existingSyncEvent) {
          var syncEventsCol = $app.findCollectionByNameOrId('automation_events')
          var syncEventRec = new Record(syncEventsCol)
          syncEventRec.set('store', storesId)
          syncEventRec.set('event_type', 'ORDER_SYNC_COMPLETED')
          syncEventRec.set('source', 'sync')
          syncEventRec.set('entity_type', 'sync')
          syncEventRec.set('entity_id', storesId)
          syncEventRec.set(
            'payload',
            JSON.stringify({ created: created, updated: updated, total: total }),
          )
          syncEventRec.set('deduplication_key', dedupKeySync)
          syncEventRec.set('status', 'PROCESSED')
          syncEventRec.set('received_at', new Date().toISOString())
          syncEventRec.set('processed_at', new Date().toISOString())
          $app.save(syncEventRec)
        }
      } catch (_) {}

      return e.json(200, {
        created: created,
        updated: updated,
        total: total,
        errors: errors,
        status: 'success',
      })
    } catch (err) {
      return e.json(500, { error: 'Erro na sincronização de pedidos: ' + String(err) })
    }
  },
  $apis.requireAuth(),
)
