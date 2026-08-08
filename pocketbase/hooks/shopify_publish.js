routerAdd(
  'POST',
  '/backend/v1/shopify/publish/{id}',
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

      function logAction(
        storeId,
        userId,
        actionType,
        entityType,
        entityId,
        statusVal,
        summary,
        beforeSnap,
        afterSnap,
      ) {
        try {
          var logCol = $app.findCollectionByNameOrId('action_logs')
          var logRec = new Record(logCol)
          logRec.set('store', storeId)
          logRec.set('user', userId)
          logRec.set('action_type', actionType)
          logRec.set('entity_type', entityType)
          logRec.set('entity_id', entityId)
          logRec.set('status', statusVal)
          logRec.set('summary', summary)
          if (beforeSnap) logRec.set('before_snapshot', JSON.stringify(beforeSnap))
          if (afterSnap) logRec.set('after_snapshot', JSON.stringify(afterSnap))
          $app.save(logRec)
        } catch (_) {}
      }

      var productId = e.request.pathValue('id')
      if (!productId) return e.badRequestError('ID do produto é obrigatório')

      var config = getConfig()
      if (!config.configured) {
        return e.json(400, { error: 'Shopify não configurada' })
      }

      var storeRecord = getStore()
      if (!storeRecord) return e.json(400, { error: 'Nenhuma loja configurada' })

      var product
      try {
        product = $app.findRecordById('products', productId)
      } catch (_) {
        return e.notFoundError('Produto não encontrado')
      }

      var productTitle = product.getString('name')
      var productPrice = product.getFloat('price')
      var productDescription = product.getString('description') || ''
      var vendor = product.getString('vendor') || ''
      var productType = product.getString('product_type') || ''
      var tags = product.getString('tags') || ''
      var existingShopifyId = product.getString('shopify_id')

      var userId = e.auth ? e.auth.id : ''

      if (existingShopifyId && existingShopifyId.indexOf('gid://shopify/Product/') !== -1) {
        return e.json(200, {
          productId: existingShopifyId,
          handle: product.getString('slug') || '',
          status: 'DRAFT',
          message: 'Produto já existe na Shopify.',
          reused: true,
        })
      }

      var mutation =
        'mutation productSet($synchronous: Boolean!, $productSet: ProductSetInput!) { productSet(synchronous: $synchronous, input: $productSet) { product { id handle status } userErrors { field message } } }'

      var tagList = tags
        ? tags
            .split(',')
            .map(function (t) {
              return t.trim()
            })
            .filter(function (t) {
              return t !== ''
            })
        : []

      var variants = [
        {
          price: String(productPrice),
        },
      ]

      var productInput = {
        title: productTitle,
        descriptionHtml: productDescription,
        status: 'DRAFT',
        vendor: vendor,
        productType: productType,
        tags: tagList,
        variants: variants,
      }

      if (product.getString('seo_title') || product.getString('meta_description')) {
        productInput.seo = {
          title: product.getString('seo_title') || productTitle,
          description: product.getString('meta_description') || '',
        }
      }

      var graphQLRes = shopifyGraphQL(
        mutation,
        {
          synchronous: true,
          productSet: productInput,
        },
        storeRecord,
      )

      if (graphQLRes.statusCode !== 200) {
        product.set('shopify_status', 'SYNC_ERROR')
        $app.save(product)
        logAction(
          storeRecord.id,
          userId,
          'shopify_publish',
          'product',
          productId,
          'FAILED',
          'Falha ao publicar produto: HTTP ' + graphQLRes.statusCode,
        )
        return e.json(graphQLRes.statusCode, {
          error: 'Shopify retornou status ' + graphQLRes.statusCode,
        })
      }

      var body = graphQLRes.json
      var gqlErrors = parseErrors(body)
      if (gqlErrors.length > 0) {
        product.set('shopify_status', 'SYNC_ERROR')
        $app.save(product)
        logAction(
          storeRecord.id,
          userId,
          'shopify_publish',
          'product',
          productId,
          'FAILED',
          gqlErrors.join('; '),
        )
        return e.json(400, { error: gqlErrors.join('; ') })
      }

      var result = body.data && body.data.productSet ? body.data.productSet : {}

      if (result.userErrors && result.userErrors.length > 0) {
        var userErrorMessages = []
        for (var i = 0; i < result.userErrors.length; i++) {
          userErrorMessages.push(result.userErrors[i].message)
        }
        product.set('shopify_status', 'SYNC_ERROR')
        $app.save(product)
        logAction(
          storeRecord.id,
          userId,
          'shopify_publish',
          'product',
          productId,
          'FAILED',
          userErrorMessages.join('; '),
        )
        return e.json(400, { error: 'Erros de validação: ' + userErrorMessages.join('; ') })
      }

      var createdProduct = result.product || {}
      var createdId = createdProduct.id || ''
      var createdHandle = createdProduct.handle || ''
      var createdStatus = createdProduct.status || 'DRAFT'

      if (createdId) {
        product.set('shopify_id', createdId)
        product.set('shopify_status', 'SHOPIFY_DRAFT')
        if (createdHandle) product.set('slug', createdHandle)
        $app.save(product)
        logAction(
          storeRecord.id,
          userId,
          'shopify_publish',
          'product',
          productId,
          'EXECUTED',
          'Produto enviado como rascunho para Shopify: ' + createdHandle,
        )
      }

      return e.json(200, {
        productId: createdId,
        handle: createdHandle,
        status: createdStatus,
        message: 'Produto enviado como rascunho na Shopify.',
        reused: false,
      })
    } catch (err) {
      return e.json(500, { error: 'Erro ao publicar produto: ' + String(err) })
    }
  },
  $apis.requireAuth(),
)
