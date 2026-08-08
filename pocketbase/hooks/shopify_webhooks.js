routerAdd('POST', '/backend/v1/shopify/webhook', (e) => {
  try {
    var rawBody = e.request.body
    var hmacHeader = e.request.header.get('X-Shopify-Hmac-Sha256') || ''
    var clientSecret = $secrets.get('SHOPIFY_CLIENT_SECRET') || ''

    if (!clientSecret) {
      return e.json(401, { error: 'Webhook secret not configured' })
    }

    var computedHmac = $security.hs256(rawBody, clientSecret)

    if (computedHmac !== hmacHeader) {
      $app.logger().warn('Shopify webhook HMAC invalid', 'ip', e.request.remoteAddr)
      return e.json(401, { error: 'HMAC invalid' })
    }

    var topic = e.request.header.get('X-Shopify-Topic') || ''
    var body = e.requestInfo().body || {}

    $app.logger().info('Shopify webhook received', 'topic', topic, 'id', body.id || '')

    var storeRecord = null
    try {
      var stores = $app.findRecordsByFilter('stores', "id != ''", 'created', 1, 0)
      if (stores.length > 0) storeRecord = stores[0]
    } catch (_) {}

    if (topic === 'app/uninstalled') {
      if (storeRecord) {
        storeRecord.set('connected', false)
        $app.save(storeRecord)
      }
      return e.json(200, { received: true })
    }

    if (storeRecord) {
      var eventType = ''
      var entityType = ''
      var entityId = ''
      var payload = {}

      if (topic === 'products/create') {
        eventType = 'SHOPIFY_PRODUCT_CREATED'
        entityType = 'product'
        entityId = body.id ? String(body.id) : ''
        payload = {
          product: {
            id: body.id,
            title: body.title,
            handle: body.handle,
            seo_title: body.seo_title || '',
            status: body.status || '',
          },
        }
      } else if (topic === 'products/update') {
        eventType = 'SHOPIFY_PRODUCT_UPDATED'
        entityType = 'product'
        entityId = body.id ? String(body.id) : ''
        payload = {
          product: {
            id: body.id,
            title: body.title,
            handle: body.handle,
            seo_title: body.seo_title || '',
            status: body.status || '',
          },
        }
      } else if (topic === 'orders/create') {
        eventType = 'SHOPIFY_ORDER_CREATED'
        entityType = 'order'
        entityId = body.id ? String(body.id) : ''
        payload = {
          order: {
            id: body.id,
            name: body.name,
            total_price: body.total_price,
            financial_status: body.financial_status || '',
          },
        }
      } else if (topic === 'orders/paid') {
        eventType = 'SHOPIFY_ORDER_PAID'
        entityType = 'order'
        entityId = body.id ? String(body.id) : ''
        payload = { order: { id: body.id, name: body.name, total_price: body.total_price } }
      } else if (topic === 'orders/fulfilled') {
        eventType = 'SHOPIFY_ORDER_FULFILLED'
        entityType = 'order'
        entityId = body.id ? String(body.id) : ''
        payload = { order: { id: body.id, name: body.name } }
      } else if (topic === 'inventory_levels/update') {
        eventType = 'SHOPIFY_INVENTORY_UPDATED'
        entityType = 'inventory'
        entityId = body.inventory_item_id ? String(body.inventory_item_id) : ''
        payload = {
          inventory: {
            item_id: body.inventory_item_id,
            available: body.available,
            quantity: body.available || 0,
          },
        }
      }

      if (eventType) {
        var dedupKey =
          'shopify:' + topic + ':' + entityId + ':' + new Date().toISOString().substring(0, 13)
        try {
          var existingEvent = $app.findFirstRecordByFilter(
            'automation_events',
            'deduplication_key = {:dk}',
            { dk: dedupKey },
          )
          if (!existingEvent) {
            var eventsCol = $app.findCollectionByNameOrId('automation_events')
            var eventRec = new Record(eventsCol)
            eventRec.set('store', storeRecord.id)
            eventRec.set('event_type', eventType)
            eventRec.set('source', 'shopify_webhook')
            eventRec.set('entity_type', entityType)
            eventRec.set('entity_id', entityId)
            eventRec.set('payload', JSON.stringify(payload))
            eventRec.set('deduplication_key', dedupKey)
            eventRec.set('status', 'PENDING')
            eventRec.set('received_at', new Date().toISOString())
            $app.save(eventRec)
            $app
              .logger()
              .info('automation_event_created', 'eventType', eventType, 'eventId', eventRec.id)

            var rules = $app.findRecordsByFilter(
              'automation_rules',
              'store = {:sid} && enabled = true && trigger_type = {:tt}',
              '-priority',
              50,
              0,
              { sid: storeRecord.id, tt: eventType },
            )
            var jobsCol = $app.findCollectionByNameOrId('automation_jobs')
            for (var ri = 0; ri < rules.length; ri++) {
              var rule = rules[ri]
              var jobRec = new Record(jobsCol)
              jobRec.set('store', storeRecord.id)
              jobRec.set('rule', rule.id)
              jobRec.set('event', eventRec.id)
              jobRec.set('job_type', rule.getString('action_type'))
              jobRec.set('status', 'QUEUED')
              jobRec.set('priority', rule.getNumber('priority') || 5)
              jobRec.set('payload', JSON.stringify(payload))
              jobRec.set('attempts', 0)
              jobRec.set('max_attempts', 3)
              jobRec.set('scheduled_for', new Date().toISOString())
              $app.save(jobRec)
            }
          }
        } catch (eventErr) {
          $app.logger().error('automation_event_webhook_error', 'error', String(eventErr))
        }
      }
    }

    return e.json(200, { received: true })
  } catch (err) {
    $app.logger().error('Shopify webhook error', 'error', String(err))
    return e.json(500, { error: 'Internal error' })
  }
})
