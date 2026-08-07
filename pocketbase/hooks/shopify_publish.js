routerAdd(
  'POST',
  '/backend/v1/shopify/publish/{id}',
  (e) => {
    try {
      const productId = e.request.pathValue('id')
      if (!productId) {
        return e.badRequestError('ID do produto é obrigatório')
      }

      const token = $secrets.get('SHOPIFY_ACCESS_TOKEN') || ''
      const domain = $secrets.get('SHOPIFY_STORE_DOMAIN') || ''

      if (!token || !domain) {
        return e.json(400, {
          error:
            'Conexão não configurada. Defina SHOPIFY_ACCESS_TOKEN e SHOPIFY_STORE_DOMAIN nos secrets do Skip Cloud.',
        })
      }

      if (
        !token.startsWith('shpat_') &&
        !token.startsWith('shpss_') &&
        !token.startsWith('shppa_')
      ) {
        return e.json(400, {
          error: 'SHOPIFY_ACCESS_TOKEN inválido. O token deve começar com "shpat_".',
        })
      }

      var cleanDomain = domain
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, '')
        .replace(/\/.*$/, '')

      if (!cleanDomain.match(/^[a-z0-9][a-z0-9\-]*\.myshopify\.com$/)) {
        return e.json(400, {
          error: 'SHOPIFY_STORE_DOMAIN inválido. Use o formato "sualoja.myshopify.com".',
        })
      }

      let product
      try {
        product = $app.findRecordById('products', productId)
      } catch (_) {
        return e.notFoundError('Produto não encontrado')
      }

      const variantTitle = product.getString('name')
      const price = product.getFloat('price')
      const existingDraftId = product.getString('shopify_draft_id')

      const apiVersion = '2024-10'
      const baseUrl = 'https://' + cleanDomain + '/admin/api/' + apiVersion

      if (existingDraftId) {
        const fetchUrl = baseUrl + '/draft_orders/' + existingDraftId + '.json'
        let fetchRes
        try {
          fetchRes = $http.send({
            url: fetchUrl,
            method: 'GET',
            headers: {
              'X-Shopify-Access-Token': token,
              'Content-Type': 'application/json',
            },
            timeout: 15,
          })
        } catch (err) {
          return e.json(502, {
            error: 'Falha de rede ao verificar draft existente: ' + String(err),
          })
        }

        if (fetchRes.statusCode === 200) {
          let draftData
          try {
            draftData = fetchRes.json
          } catch (_) {
            draftData = {}
          }
          const draft = draftData.draft_order || {}
          return e.json(200, {
            draftId: String(draft.id || existingDraftId),
            status: draft.status || 'open',
            message: 'Draft já existente reutilizado.',
            reused: true,
          })
        }

        if (fetchRes.statusCode === 404) {
          // Draft was deleted on Shopify, clear stale id and continue to create new
          product.set('shopify_draft_id', '')
          $app.save(product)
        }
      }

      const url = baseUrl + '/draft_orders.json'

      const payload = {
        draft_order: {
          line_items: [
            {
              title: variantTitle,
              price: price,
              quantity: 1,
            },
          ],
        },
      }

      let res
      try {
        res = $http.send({
          url: url,
          method: 'POST',
          headers: {
            'X-Shopify-Access-Token': token,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          timeout: 30,
        })
      } catch (err) {
        return e.json(502, { error: 'Falha de rede ao criar draft order: ' + String(err) })
      }

      if (res.statusCode === 401 || res.statusCode === 403) {
        return e.json(res.statusCode, {
          error:
            'Token recusado pela Shopify (HTTP ' +
            res.statusCode +
            '). Certifique-se de que o Custom App tem a permissão write_draft_orders.',
        })
      }

      if (res.statusCode !== 201 && res.statusCode !== 200) {
        let errMsg = 'Shopify retornou status ' + res.statusCode
        try {
          const errBody = res.json
          if (errBody && errBody.errors) {
            errMsg = 'Shopify: ' + JSON.stringify(errBody.errors)
          }
        } catch (_) {}
        return e.json(res.statusCode, { error: errMsg })
      }

      let responseBody
      try {
        responseBody = res.json
      } catch (_) {
        return e.json(500, { error: 'Resposta inválida do Shopify ao criar draft order.' })
      }

      const draft = responseBody.draft_order || {}
      const draftId = String(draft.id || '')

      if (draftId) {
        product.set('shopify_draft_id', draftId)
        $app.save(product)
      }

      return e.json(200, {
        draftId: draftId,
        status: draft.status || 'open',
        message: 'Produto publicado como draft order na Shopify.',
        reused: false,
      })
    } catch (err) {
      return e.json(500, { error: 'Erro ao publicar produto: ' + String(err) })
    }
  },
  $apis.requireAuth(),
)
