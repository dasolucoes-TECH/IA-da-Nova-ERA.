migrate(
  (app) => {
    var storesId = app.findCollectionByNameOrId('stores').id

    var storesCol = app.findCollectionByNameOrId('stores')
    if (!storesCol.fields.getByName('cached_token')) {
      storesCol.fields.add(new TextField({ name: 'cached_token', hidden: true }))
    }
    if (!storesCol.fields.getByName('token_expires_at')) {
      storesCol.fields.add(new DateField({ name: 'token_expires_at', hidden: true }))
    }
    if (!storesCol.fields.getByName('cached_scopes')) {
      storesCol.fields.add(new TextField({ name: 'cached_scopes', hidden: true }))
    }
    app.save(storesCol)

    function addIfMissing(colName, field) {
      var col = app.findCollectionByNameOrId(colName)
      if (col.fields.getByName(field.name)) return
      if (field.type === 'relation') {
        col.fields.add(
          new RelationField({
            name: field.name,
            collectionId: field.collectionId,
            maxSelect: field.maxSelect || 1,
          }),
        )
      } else if (field.type === 'select') {
        col.fields.add(
          new SelectField({
            name: field.name,
            values: field.values,
            maxSelect: field.maxSelect || 1,
          }),
        )
      } else if (field.type === 'text') {
        col.fields.add(new TextField({ name: field.name }))
      } else if (field.type === 'date') {
        col.fields.add(new DateField({ name: field.name }))
      }
      app.save(col)
    }

    var collectionsWithStore = [
      'products',
      'orders',
      'campaigns',
      'banners',
      'analytics_events',
      'suppliers',
      'product_collections',
    ]
    for (var i = 0; i < collectionsWithStore.length; i++) {
      addIfMissing(collectionsWithStore[i], {
        name: 'store',
        type: 'relation',
        collectionId: storesId,
        maxSelect: 1,
      })
    }

    var collectionsWithDataOrigin = [
      'products',
      'orders',
      'campaigns',
      'banners',
      'suppliers',
      'product_collections',
    ]
    for (var j = 0; j < collectionsWithDataOrigin.length; j++) {
      addIfMissing(collectionsWithDataOrigin[j], {
        name: 'data_origin',
        type: 'select',
        values: ['shopify', 'local', 'demo', 'system'],
        maxSelect: 1,
      })
    }

    addIfMissing('products', { name: 'product_type', type: 'text' })
    addIfMissing('products', { name: 'shopify_status', type: 'text' })
    addIfMissing('products', { name: 'shopify_created_at', type: 'date' })
    addIfMissing('products', { name: 'shopify_updated_at', type: 'date' })
    addIfMissing('products', { name: 'tags', type: 'text' })

    addIfMissing('orders', { name: 'fulfillment_status', type: 'text' })
    addIfMissing('orders', { name: 'currency', type: 'text' })
    addIfMissing('orders', { name: 'created_at_shopify', type: 'date' })
    addIfMissing('orders', { name: 'updated_at_shopify', type: 'date' })
  },
  (app) => {
    var storesCol = app.findCollectionByNameOrId('stores')
    var hiddenFields = ['cached_token', 'token_expires_at', 'cached_scopes']
    for (var h = 0; h < hiddenFields.length; h++) {
      var hf = storesCol.fields.getByName(hiddenFields[h])
      if (hf) storesCol.fields.remove(hf)
    }
    app.save(storesCol)
  },
)
