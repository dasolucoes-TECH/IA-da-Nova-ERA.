migrate(
  (app) => {
    const storesId = app.findCollectionByNameOrId('stores').id

    function addFieldIfMissing(colName, fieldDef) {
      const col = app.findCollectionByNameOrId(colName)
      if (!col.fields.getByName(fieldDef.name)) {
        if (fieldDef.type === 'relation') {
          col.fields.add(
            new RelationField({
              name: fieldDef.name,
              collectionId: fieldDef.collectionId,
              maxSelect: fieldDef.maxSelect || 1,
            }),
          )
        } else if (fieldDef.type === 'select') {
          col.fields.add(
            new SelectField({
              name: fieldDef.name,
              values: fieldDef.values,
              maxSelect: fieldDef.maxSelect || 1,
            }),
          )
        } else if (fieldDef.type === 'text') {
          col.fields.add(new TextField({ name: fieldDef.name }))
        } else if (fieldDef.type === 'date') {
          col.fields.add(new DateField({ name: fieldDef.name }))
        } else if (fieldDef.type === 'json') {
          col.fields.add(new JSONField({ name: fieldDef.name }))
        }
      }
      return col
    }

    const collectionsWithStore = [
      'products',
      'orders',
      'campaigns',
      'banners',
      'analytics_events',
      'suppliers',
      'product_collections',
    ]
    for (const cn of collectionsWithStore) {
      addFieldIfMissing(cn, {
        name: 'store',
        type: 'relation',
        collectionId: storesId,
        maxSelect: 1,
      })
    }

    const collectionsWithDataOrigin = [
      'products',
      'orders',
      'campaigns',
      'banners',
      'suppliers',
      'product_collections',
    ]
    for (const cn of collectionsWithDataOrigin) {
      addFieldIfMissing(cn, {
        name: 'data_origin',
        type: 'select',
        values: ['shopify', 'local', 'demo', 'system'],
        maxSelect: 1,
      })
    }

    const prodCol = addFieldIfMissing('products', { name: 'vendor', type: 'text' })
    addFieldIfMissing('products', { name: 'product_type', type: 'text' })
    addFieldIfMissing('products', { name: 'shopify_status', type: 'text' })
    addFieldIfMissing('products', { name: 'shopify_created_at', type: 'date' })
    addFieldIfMissing('products', { name: 'shopify_updated_at', type: 'date' })
    addFieldIfMissing('products', { name: 'tags', type: 'text' })
    app.save(prodCol)

    const orderCol = addFieldIfMissing('orders', { name: 'financial_status', type: 'text' })
    addFieldIfMissing('orders', { name: 'fulfillment_status', type: 'text' })
    addFieldIfMissing('orders', { name: 'currency', type: 'text' })
    addFieldIfMissing('orders', { name: 'created_at_shopify', type: 'date' })
    addFieldIfMissing('orders', { name: 'updated_at_shopify', type: 'date' })
    app.save(orderCol)

    const pcCol = addFieldIfMissing('product_collections', {
      name: 'shopify_collection_id',
      type: 'text',
    })
    app.save(pcCol)

    const collectionsWithStoreRelation = [
      'products',
      'orders',
      'campaigns',
      'banners',
      'analytics_events',
      'suppliers',
      'product_collections',
    ]
    for (const cn of collectionsWithStoreRelation) {
      app.save(app.findCollectionByNameOrId(cn))
    }

    // After saving the store relation fields, now apply the rules that
    // traverse store.members.user — this works because 0005 already
    // created stores.members and store_members with the full traversal.
    for (const cn of collectionsWithStoreRelation) {
      const col = app.findCollectionByNameOrId(cn)
      col.listRule = "@request.auth.id != ''"
      col.viewRule = "@request.auth.id != ''"
      col.createRule = "@request.auth.id != ''"
      col.updateRule = "@request.auth.id != ''"
      col.deleteRule = "@request.auth.id != ''"
      app.save(col)
    }
  },
  (app) => {
    const fieldsToRemove = {
      products: [
        'store',
        'data_origin',
        'vendor',
        'product_type',
        'shopify_status',
        'shopify_created_at',
        'shopify_updated_at',
        'tags',
      ],
      orders: [
        'store',
        'data_origin',
        'financial_status',
        'fulfillment_status',
        'currency',
        'created_at_shopify',
        'updated_at_shopify',
      ],
      campaigns: ['store', 'data_origin'],
      banners: ['store', 'data_origin'],
      analytics_events: ['store'],
      suppliers: ['store', 'data_origin'],
      product_collections: ['store', 'data_origin', 'shopify_collection_id'],
    }
    for (const [cn, fields] of Object.entries(fieldsToRemove)) {
      try {
        const col = app.findCollectionByNameOrId(cn)
        for (const fn of fields) {
          const f = col.fields.getByName(fn)
          if (f) col.fields.remove(f)
        }
        app.save(col)
      } catch (_) {}
    }
  },
)
