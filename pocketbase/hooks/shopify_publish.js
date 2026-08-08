routerAdd(
  'POST',
  '/backend/v1/shopify/publish/{id}',
  (e) => {
    try {
      var productId = e.request.pathValue('id')
      if (!productId) {
        return e.badRequestError('ID do produto é obrigatório')
      }

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

      var product
      try {
        product = $app.findRecordById('products', productId)
      } catch (_) {
        return e.notFoundError('Produto não encontrado')
      }

      var productTitle = product.getString('name')
      var productPrice = product.getFloat('price')
      var productDescription = product.getString('description') || ''
      var productType = ''
      if (product.get('collection')) {
        try {
          var col = $app.findRecordById('product_collections', product.getString('collection'))
          productType = col.getString('name')
        } catch (_) {}
      }
      var existingShopifyId = product.getString('shopify_id')

      if (existingShopifyId && existingShopifyId.indexOf('gid://shopify/Product/') !== -1) {
        return e.json(200, {
          productId: existingShopifyId,
          handle: product.getString('slug') || '',
          status: 'DRAFT',
          message: 'Produto já publicado na Shopify como DRAFT.',
          reused: true,
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

      var mutation =
        'mutation productCreate($input: ProductCreateInput!) { productCreate(input: $input) { product { id handle status } userErrors { field message } } }'

      var variables = {
        input: {
          title: productTitle,
          status: 'DRAFT',
          descriptionHtml: productDescription,
          productType: productType,
          variants: [
            {
              price: String(productPrice),
            },
          ],
        },
      }

      var graphQLRes
      try {
        graphQLRes = runGraphQL(mutation, variables, accessToken)
      } catch (err) {
        return e.json(502, {
          error: 'Falha de rede ao criar produto: ' + String(err),
        })
      }

      if (graphQLRes.statusCode === 401) {
        try {
          accessToken = getAccessToken()
          graphQLRes = runGraphQL(mutation, variables, accessToken)
        } catch (retryErr) {
          return e.json(401, {
            error: 'Token renovado mas falha persiste: ' + String(retryErr),
          })
        }
      }

      if (graphQLRes.statusCode !== 200) {
        return e.json(graphQLRes.statusCode, {
          error: 'Shopify retornou status ' + graphQLRes.statusCode + ' ao criar produto.',
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

      var result = body.data && body.data.productCreate ? body.data.productCreate : {}

      if (result.userErrors && result.userErrors.length > 0) {
        var userErrorMessages = []
        for (var i = 0; i < result.userErrors.length; i++) {
          userErrorMessages.push(result.userErrors[i].message)
        }
        return e.json(400, {
          error: 'Erros de validação: ' + userErrorMessages.join('; '),
        })
      }

      var createdProduct = result.product || {}
      var createdId = createdProduct.id || ''
      var createdHandle = createdProduct.handle || ''
      var createdStatus = createdProduct.status || 'DRAFT'

      if (createdId) {
        product.set('shopify_id', createdId)
        if (createdHandle) product.set('slug', createdHandle)
        $app.save(product)
      }

      return e.json(200, {
        productId: createdId,
        handle: createdHandle,
        status: createdStatus,
        message: 'Produto publicado na Shopify como DRAFT.',
        reused: false,
      })
    } catch (err) {
      return e.json(500, { error: 'Erro ao publicar produto: ' + String(err) })
    }
  },
  $apis.requireAuth(),
)
