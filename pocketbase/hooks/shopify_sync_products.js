routerAdd(
  'POST',
  '/backend/v1/shopify/sync-products',
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

      var existingSyncs = $app.findRecordsByFilter(
        'integration_syncs',
        "sync_type = 'products' && status = 'running'",
        '-created',
        1,
        0,
      )
      if (existingSyncs.length > 0) {
        return e.json(409, {
          error: 'SYNC_ALREADY_RUNNING',
          message: 'Sincronização de produtos já em andamento',
        })
      }

      var prodCol = $app.findCollectionByNameOrId('products')
      var variantCol = $app.findCollectionByNameOrId('product_variants')
      var mediaCol = $app.findCollectionByNameOrId('product_media')
      var storesId = storeRecord.id

      var created = 0
      var updated = 0
      var total = 0
      var errors = []
      var hasNextPage = true
      var cursor = null

      while (hasNextPage) {
        var query =
          'query SyncProducts($cursor: String) { products(first: 100, after: $cursor) { edges { node { id title handle status descriptionHtml vendor productType tags seo { title description } createdAt updatedAt featuredImage { url altText } variants(first: 50) { edges { node { id title sku barcode price compareAtPrice inventoryQuantity inventoryItemId position selectedOptions { name value } } } } } } pageInfo { hasNextPage endCursor } } }'

        var graphQLRes = shopifyGraphQL(query, { cursor: cursor }, storeRecord)

        if (graphQLRes.statusCode !== 200) {
          errors.push({ error: 'Shopify status ' + graphQLRes.statusCode })
          break
        }

        var body = graphQLRes.json
        var gqlErrors = parseErrors(body)
        if (gqlErrors.length > 0) {
          errors.push({ error: gqlErrors.join('; ') })
          break
        }

        var productsData =
          body.data && body.data.products
            ? body.data.products
            : { edges: [], pageInfo: { hasNextPage: false } }
        var edges = productsData.edges || []
        total += edges.length

        for (var i = 0; i < edges.length; i++) {
          var sp = edges[i].node
          var shopifyId = sp.id
          var existing = null
          try {
            existing = $app.findFirstRecordByFilter(
              'products',
              'shopify_id = {:sid} && store = {:st}',
              { sid: shopifyId, st: storesId },
            )
          } catch (_) {}

          var price = 0
          var variantEdges = sp.variants && sp.variants.edges ? sp.variants.edges : []
          if (variantEdges.length > 0) {
            price = parseFloat(variantEdges[0].node.price) || 0
          }

          var status = sp.status === 'ACTIVE' ? 'publicado' : 'rascunho'
          var shopifyStatus = sp.status === 'ACTIVE' ? 'SHOPIFY_ACTIVE' : 'SHOPIFY_DRAFT'

          if (existing) {
            existing.set('name', sp.title || existing.getString('name'))
            existing.set('description', sp.descriptionHtml || existing.getString('description'))
            existing.set('price', price)
            existing.set('status', status)
            existing.set('shopify_status', shopifyStatus)
            existing.set('vendor', sp.vendor || '')
            existing.set('product_type', sp.productType || '')
            existing.set('tags', sp.tags && Array.isArray(sp.tags) ? sp.tags.join(', ') : '')
            existing.set('slug', sp.handle || existing.getString('slug'))
            if (sp.seo) {
              existing.set('seo_title', sp.seo.title || existing.getString('seo_title'))
              existing.set(
                'meta_description',
                sp.seo.description || existing.getString('meta_description'),
              )
            }
            if (sp.createdAt) existing.set('shopify_created_at', sp.createdAt)
            if (sp.updatedAt) existing.set('shopify_updated_at', sp.updatedAt)
            existing.set('data_origin', 'shopify')
            try {
              $app.save(existing)
              updated++
            } catch (saveErr) {
              errors.push({ product: sp.title, error: String(saveErr) })
            }
          } else {
            try {
              var rec = new Record(prodCol)
              rec.set('name', sp.title || 'Produto Shopify')
              rec.set('description', sp.descriptionHtml || '')
              rec.set('price', price)
              rec.set('cost', 0)
              rec.set('stock', 0)
              rec.set('status', status)
              rec.set('shopify_status', shopifyStatus)
              rec.set('shopify_id', shopifyId)
              rec.set('slug', sp.handle || '')
              rec.set('vendor', sp.vendor || '')
              rec.set('product_type', sp.productType || '')
              rec.set('tags', sp.tags && Array.isArray(sp.tags) ? sp.tags.join(', ') : '')
              rec.set('store', storesId)
              rec.set('data_origin', 'shopify')
              rec.set('sales_count', 0)
              if (sp.seo) {
                rec.set('seo_title', sp.seo.title || '')
                rec.set('meta_description', sp.seo.description || '')
              }
              if (sp.createdAt) rec.set('shopify_created_at', sp.createdAt)
              if (sp.updatedAt) rec.set('shopify_updated_at', sp.updatedAt)
              $app.save(rec)
              created++
              existing = rec
            } catch (saveErr) {
              errors.push({ product: sp.title, error: String(saveErr) })
              continue
            }
          }

          for (var v = 0; v < variantEdges.length; v++) {
            var sv = variantEdges[v].node
            var existingVariant = null
            try {
              existingVariant = $app.findFirstRecordByFilter(
                'product_variants',
                'shopify_variant_id = {:vid} && store = {:st}',
                { vid: sv.id, st: storesId },
              )
            } catch (_) {}

            if (existingVariant) {
              existingVariant.set('title', sv.title || '')
              existingVariant.set('sku', sv.sku || '')
              existingVariant.set('barcode', sv.barcode || '')
              existingVariant.set('price', parseFloat(sv.price) || 0)
              existingVariant.set('compare_at_price', parseFloat(sv.compareAtPrice) || 0)
              existingVariant.set('inventory_quantity', sv.inventoryQuantity || 0)
              existingVariant.set('inventory_item_id', sv.inventoryItemId || '')
              existingVariant.set('position', sv.position || 0)
              existingVariant.set('selected_options', JSON.stringify(sv.selectedOptions || []))
              $app.save(existingVariant)
            } else {
              try {
                var vRec = new Record(variantCol)
                vRec.set('store', storesId)
                vRec.set('product', existing.id)
                vRec.set('shopify_variant_id', sv.id)
                vRec.set('title', sv.title || '')
                vRec.set('sku', sv.sku || '')
                vRec.set('barcode', sv.barcode || '')
                vRec.set('price', parseFloat(sv.price) || 0)
                vRec.set('compare_at_price', parseFloat(sv.compareAtPrice) || 0)
                vRec.set('inventory_quantity', sv.inventoryQuantity || 0)
                vRec.set('inventory_item_id', sv.inventoryItemId || '')
                vRec.set('position', sv.position || 0)
                vRec.set('selected_options', JSON.stringify(sv.selectedOptions || []))
                $app.save(vRec)
              } catch (_) {}
            }
          }

          if (sp.featuredImage && sp.featuredImage.url) {
            var existingMedia = null
            try {
              existingMedia = $app.findFirstRecordByFilter(
                'product_media',
                'product = {:pid} && store = {:st}',
                { pid: existing.id, st: storesId },
              )
            } catch (_) {}
            if (!existingMedia) {
              try {
                var mRec = new Record(mediaCol)
                mRec.set('store', storesId)
                mRec.set('product', existing.id)
                mRec.set('url', sp.featuredImage.url)
                mRec.set('alt', sp.featuredImage.altText || sp.title || '')
                mRec.set('media_type', 'image')
                mRec.set('position', 1)
                $app.save(mRec)
              } catch (_) {}
            }
          }
        }

        var pageInfo = productsData.pageInfo || { hasNextPage: false }
        hasNextPage = pageInfo.hasNextPage || false
        cursor = pageInfo.endCursor || null
      }

      if (storeRecord) {
        storeRecord.set('last_product_sync', new Date().toISOString())
        $app.save(storeRecord)
      }

      logSync(
        storesId,
        'products',
        'success',
        { processed: total, created: created, updated: updated },
        errors,
      )

      try {
        var syncDedupKey =
          'sync:PRODUCT_SYNC_COMPLETED:' + storesId + ':' + new Date().toISOString()
        var syncBaseUrl = $secrets.get('PB_INSTANCE_URL') || ''
        var syncInternalSecret = $secrets.get('PB_SUPERUSER_TOKEN') || ''
        $http.send({
          url: syncBaseUrl + '/backend/v1/autopilot/emit-event-core',
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Internal-Secret': syncInternalSecret },
          body: JSON.stringify({
            storeId: storesId,
            eventType: 'PRODUCT_SYNC_COMPLETED',
            source: 'sync',
            entityType: 'sync',
            entityId: storesId,
            payload: { created: created, updated: updated, total: total },
            deduplicationKey: syncDedupKey,
          }),
          timeout: 30,
        })
      } catch (_) {}

      return e.json(200, {
        created: created,
        updated: updated,
        total: total,
        errors: errors,
        status: 'success',
      })
    } catch (err) {
      return e.json(500, { error: 'Erro na sincronização de produtos: ' + String(err) })
    }
  },
  $apis.requireAuth(),
)
