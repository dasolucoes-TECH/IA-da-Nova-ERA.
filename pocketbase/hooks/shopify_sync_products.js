routerAdd(
  'POST',
  '/backend/v1/shopify/sync-products',
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
      const url = 'https://' + domain + '/admin/api/' + apiVersion + '/products.json?limit=250'

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
        return e.json(502, { error: 'Falha de rede ao buscar produtos: ' + String(err) })
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

      const products = body.products || []
      let created = 0
      let updated = 0
      let errors = []

      const prodCol = $app.findCollectionByNameOrId('products')
      const supCol = $app.findCollectionByNameOrId('suppliers')
      let defaultSupplier
      try {
        defaultSupplier = $app.findFirstRecordByData('suppliers', 'name', 'Fornecedor Alpha')
      } catch (_) {
        const sups = $app.findRecordsByFilter('suppliers', "id != ''", 'name', 1, 0)
        defaultSupplier = sups.length > 0 ? sups[0] : null
      }
      const pcCol = $app.findCollectionByNameOrId('product_collections')
      let defaultCollection
      try {
        defaultCollection = $app.findFirstRecordByData('product_collections', 'handle', 'moda')
      } catch (_) {
        const pcs = $app.findRecordsByFilter('product_collections', "id != ''", 'name', 1, 0)
        defaultCollection = pcs.length > 0 ? pcs[0] : null
      }

      for (const sp of products) {
        const shopifyId = String(sp.id)
        let existing = null
        try {
          existing = $app.findFirstRecordByData('products', 'shopify_id', shopifyId)
        } catch (_) {}

        const variant = sp.variants && sp.variants.length > 0 ? sp.variants[0] : {}
        const price = parseFloat(variant.price) || 0
        const stock = parseInt(variant.inventory_quantity) || 0
        const status = sp.status === 'active' ? 'publicado' : 'rascunho'

        let firstImage = ''
        if (sp.images && sp.images.length > 0) {
          firstImage = sp.images[0].src || ''
        }

        if (existing) {
          existing.set('name', sp.title || existing.getString('name'))
          existing.set('description', sp.body_html || existing.getString('description'))
          existing.set('price', price)
          existing.set('stock', stock)
          existing.set('status', status)
          if (firstImage) {
            try {
              const file = $filesystem.fileFromURL(firstImage, 15)
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
            const rec = new Record(prodCol)
            rec.set('name', sp.title || 'Produto Shopify')
            rec.set('description', sp.body_html || '')
            rec.set('price', price)
            rec.set('cost', 0)
            rec.set('stock', stock)
            rec.set('status', status)
            rec.set('shopify_id', shopifyId)
            rec.set('slug', sp.handle || String(sp.id))
            rec.set('sales_count', 0)
            if (defaultSupplier) rec.set('supplier', defaultSupplier.id)
            if (defaultCollection) rec.set('collection', defaultCollection.id)
            if (firstImage) {
              try {
                const file = $filesystem.fileFromURL(firstImage, 15)
                rec.set('images', file)
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
        total: products.length,
        errors: errors,
      })
    } catch (err) {
      return e.json(500, { error: 'Erro na sincronização de produtos: ' + String(err) })
    }
  },
  $apis.requireAuth(),
)
