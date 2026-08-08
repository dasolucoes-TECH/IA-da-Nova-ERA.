migrate(
  (app) => {
    const storesCol = app.findCollectionByNameOrId('stores')
    let defaultStore = null
    try {
      defaultStore = app.findFirstRecordByData('stores', 'name', 'Nova Era AI Store')
    } catch (_) {}

    if (!defaultStore) {
      defaultStore = new Record(storesCol)
      defaultStore.set('name', 'Nova Era AI Store')
      defaultStore.set('connected', false)
      defaultStore.set('api_version', '2026-07')
      app.save(defaultStore)
    }

    const smCol = app.findCollectionByNameOrId('store_members')
    const users = app.findRecordsByFilter('_pb_users_auth_', "id != ''", 'created', 100, 0)
    for (const u of users) {
      try {
        app.findFirstRecordByFilter('store_members', 'store = {:sid} && user = {:uid}', {
          sid: defaultStore.id,
          uid: u.id,
        })
      } catch (_) {
        const m = new Record(smCol)
        m.set('store', defaultStore.id)
        m.set('user', u.id)
        m.set('role', 'OWNER')
        app.save(m)
      }
    }

    const linkCollections = [
      'products',
      'orders',
      'campaigns',
      'banners',
      'analytics_events',
      'suppliers',
      'product_collections',
    ]
    for (const cn of linkCollections) {
      try {
        const records = app.findRecordsByFilter(cn, "id != ''", 'created', 500, 0)
        for (const r of records) {
          if (!r.get('store') || r.get('store') === '') {
            r.set('store', defaultStore.id)
          }
          if (cn !== 'analytics_events') {
            if (!r.get('data_origin') || r.get('data_origin') === '') {
              const shopifyId = r.getString('shopify_id') || ''
              if (shopifyId !== '') {
                r.set('data_origin', 'shopify')
              } else {
                r.set('data_origin', 'demo')
              }
            }
          }
          app.save(r)
        }
      } catch (_) {}
    }
  },
  (app) => {},
)
