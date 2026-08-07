migrate(
  (app) => {
    const prodCol = app.findCollectionByNameOrId('products')
    if (!prodCol.fields.getByName('shopify_id')) {
      prodCol.fields.add(new TextField({ name: 'shopify_id' }))
    }
    if (!prodCol.fields.getByName('shopify_draft_id')) {
      prodCol.fields.add(new TextField({ name: 'shopify_draft_id' }))
    }
    app.save(prodCol)

    const orderCol = app.findCollectionByNameOrId('orders')
    if (!orderCol.fields.getByName('shopify_id')) {
      orderCol.fields.add(new TextField({ name: 'shopify_id' }))
    }
    app.save(orderCol)

    app
      .db()
      .newQuery(`
      DELETE FROM products WHERE id NOT IN (
        SELECT MIN(id) FROM products GROUP BY shopify_id
      ) AND shopify_id IS NOT NULL AND shopify_id != ''
    `)
      .execute()
    app
      .db()
      .newQuery(`
      DELETE FROM orders WHERE id NOT IN (
        SELECT MIN(id) FROM orders GROUP BY shopify_id
      ) AND shopify_id IS NOT NULL AND shopify_id != ''
    `)
      .execute()

    prodCol.addIndex('idx_products_shopify_id', false, 'shopify_id', '')
    app.save(prodCol)

    orderCol.addIndex('idx_orders_shopify_id', false, 'shopify_id', '')
    app.save(orderCol)
  },
  (app) => {
    const prodCol = app.findCollectionByNameOrId('products')
    try {
      prodCol.removeIndex('idx_products_shopify_id')
    } catch (_) {}
    const f1 = prodCol.fields.getByName('shopify_id')
    if (f1) prodCol.fields.remove(f1)
    const f2 = prodCol.fields.getByName('shopify_draft_id')
    if (f2) prodCol.fields.remove(f2)
    app.save(prodCol)

    const orderCol = app.findCollectionByNameOrId('orders')
    try {
      orderCol.removeIndex('idx_orders_shopify_id')
    } catch (_) {}
    const f3 = orderCol.fields.getByName('shopify_id')
    if (f3) orderCol.fields.remove(f3)
    app.save(orderCol)
  },
)
