routerAdd(
  'POST',
  '/backend/v1/shopify/sync-products',
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

      var productsQuery =
        'query SyncProducts { products(first: 50) { edges { node { id title handle status description vendor productType featuredImage { url } variants(first: 10) { edges { node { price inventoryQuantity } } } createdAt updatedAt } } } }'

      var graphQLRes
      try {
        graphQLRes = runGraphQL(productsQuery, {}, accessToken)
      } catch (err) {
        return e.json(502, {
          error: 'Falha de rede ao buscar produtos: ' + String(err),
        })
      }

      if (graphQLRes.statusCode === 401) {
        try {
          accessToken = getAccessToken()
          graphQLRes = runGraphQL(productsQuery, {}, accessToken)
        } catch (retryErr) {
          return e.json(401, {
            error: 'Token renovado mas falha persiste: ' + String(retryErr),
          })
        }
      }

      if (graphQLRes.statusCode !== 200) {
        return e.json(graphQLRes.statusCode, {
          error: 'Shopify retornou status ' + graphQLRes.statusCode + ' ao buscar produtos.',
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
          return e.json(403, {
            error: 'Escopo Shopify insuficiente para essa operação.',
          })
        }
        return e.json(400, { error: 'Erro GraphQL: ' + errStr })
      }

      var edges = body.data && body.data.products ? body.data.products.edges : []
      var created = 0
      var updated = 0
      var errors = []

      var prodCol = $app.findCollectionByNameOrId('products')

      var defaultSupplier = null
      try {
        defaultSupplier = $app.findFirstRecordByData('suppliers', 'name', 'Fornecedor Alpha')
      } catch (_) {
        try {
          var sups = $app.findRecordsByFilter('suppliers', "id != ''", 'name', 1, 0)
          defaultSupplier = sups.length > 0 ? sups[0] : null
        } catch (_) {}
      }

      var defaultCollection = null
      try {
        defaultCollection = $app.findFirstRecordByData('product_collections', 'handle', 'moda')
      } catch (_) {
        try {
          var pcs = $app.findRecordsByFilter('product_collections', "id != ''", 'name', 1, 0)
          defaultCollection = pcs.length > 0 ? pcs[0] : null
        } catch (_) {}
      }

      for (var i = 0; i < edges.length; i++) {
        var sp = edges[i].node
        var shopifyId = sp.id
        var existing = null
        try {
          existing = $app.findFirstRecordByData('products', 'shopify_id', shopifyId)
        } catch (_) {}

        var variantEdges = sp.variants && sp.variants.edges ? sp.variants.edges : []
        var firstVariant = variantEdges.length > 0 ? variantEdges[0].node : {}
        var price = parseFloat(firstVariant.price) || 0
        var stock = firstVariant.inventoryQuantity || 0
        var status = sp.status === 'ACTIVE' ? 'publicado' : 'rascunho'

        var firstImage = ''
        if (sp.featuredImage && sp.featuredImage.url) {
          firstImage = sp.featuredImage.url
        }

        if (existing) {
          existing.set('name', sp.title || existing.getString('name'))
          existing.set('description', sp.description || existing.getString('description'))
          existing.set('price', price)
          existing.set('stock', stock)
          existing.set('status', status)
          if (firstImage) {
            try {
              var file = $filesystem.fileFromURL(firstImage, 15)
              existing.set('images', file)
            } catch (_) {}
          }
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
            rec.set('description', sp.description || '')
            rec.set('price', price)
            rec.set('cost', 0)
            rec.set('stock', stock)
            rec.set('status', status)
            rec.set('shopify_id', shopifyId)
            rec.set('slug', sp.handle || '')
            rec.set('sales_count', 0)
            if (defaultSupplier) rec.set('supplier', defaultSupplier.id)
            if (defaultCollection) rec.set('collection', defaultCollection.id)
            if (firstImage) {
              try {
                var imgFile = $filesystem.fileFromURL(firstImage, 15)
                rec.set('images', imgFile)
              } catch (_) {}
            }
            $app.save(rec)
            created++
          } catch (saveErr) {
            errors.push({ product: sp.title, error: String(saveErr) })
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
        error: 'Erro na sincronização de produtos: ' + String(err),
      })
    }
  },
  $apis.requireAuth(),
)
