routerAdd('POST', '/backend/v1/shopify/webhook', (e) => {
  try {
    var rawBody = ''
    try {
      rawBody = readerToString(e.request.body)
    } catch (_) {
      rawBody = ''
    }

    var hmacHeader = e.request.header.get('X-Shopify-Hmac-Sha256') || ''
    var clientSecret = $secrets.get('SHOPIFY_CLIENT_SECRET') || ''

    if (!clientSecret) return e.json(401, { error: 'Webhook secret not configured' })

    function base64ToHex(b64) {
      var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
      var clean = b64.replace(/=+$/, '')
      var hex = ''
      for (var i = 0; i < clean.length; i += 4) {
        var n = 0
        for (var j = 0; j < 4 && i + j < clean.length; j++) {
          n = n * 64 + chars.indexOf(clean[i + j])
        }
        hex += ((n >> 16) & 255).toString(16).padStart(2, '0')
        if (i + 2 < clean.length) hex += ((n >> 8) & 255).toString(16).padStart(2, '0')
        if (i + 3 < clean.length) hex += (n & 255).toString(16).padStart(2, '0')
      }
      return hex
    }

    function constantTimeCompare(a, b) {
      if (a.length !== b.length) return false
      var result = 0
      for (var i = 0; i < a.length; i++) {
        result |= a.charCodeAt(i) ^ b.charCodeAt(i)
      }
      return result === 0
    }

    var computedHmac = $security.hs256(rawBody, clientSecret)
    var headerHex = base64ToHex(hmacHeader)
    if (!constantTimeCompare(computedHmac, headerHex)) {
      $app.logger().warn('Shopify webhook HMAC invalid', 'ip', e.request.remoteAddr)
      return e.json(401, { error: 'HMAC invalid' })
    }

    var body = JSON.parse(rawBody)
    var topic = e.request.header.get('X-Shopify-Topic') || ''
    var webhookId = e.request.header.get('X-Shopify-Webhook-Id') || ''
    var eventId = e.request.header.get('X-Shopify-Event-Id') || ''
    var shopDomain = e.request.header.get('X-Shopify-Shop-Domain') || ''

    function normalizeDomain(d) {
      if (!d) return ''
      return d
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, '')
        .replace(/\/.*$/, '')
    }

    var normalizedDomain = normalizeDomain(shopDomain)

    $app
      .logger()
      .info('Shopify webhook received', 'topic', topic, 'id', body.id || '', 'webhookId', webhookId)

    // Tenant resolution by domain
    var storeRecord = null
    try {
      var stores = $app.findRecordsByFilter('stores', 'myshopify_domain = {:md}', 'created', 1, 0, {
        md: normalizedDomain,
      })
      if (stores.length > 0) storeRecord = stores[0]
    } catch (_) {}

    if (topic === 'app/uninstalled') {
      if (storeRecord) {
        storeRecord.set('connected', false)
        $app.save(storeRecord)
      }
      return e.json(200, { received: true })
    }

    if (!storeRecord) {
      $app.logger().warn('Shopify webhook: no store found for domain', 'domain', normalizedDomain)
      return e.json(200, { received: true, message: 'No store matched' })
    }

    var storeId = storeRecord.id
    var eventType = ''
    var entityType = ''
    var entityId = ''
    var payload = {}

    function resolveLocalEntity(type, shopifyId) {
      if (type === 'product') {
        try {
          var product = $app.findFirstRecordByFilter(
            'products',
            'shopify_id = {:sid} && store = {:st}',
            { sid: shopifyId, st: storeId },
          )
          return { localId: product.id, name: product.getString('name'), record: product }
        } catch (_) {}
      } else if (type === 'inventory') {
        try {
          var variant = $app.findFirstRecordByFilter(
            'product_variants',
            'inventory_item_id = {:iid} && store = {:st}',
            { iid: shopifyId, st: storeId },
          )
          if (variant) {
            var productId = variant.getString('product')
            var product = $app.findRecordById('products', productId)
            return {
              localId: product.id,
              name: product.getString('name'),
              variantId: variant.id,
              sku: variant.getString('sku'),
              shopifyVariantId: variant.getString('shopify_variant_id'),
            }
          }
        } catch (_) {}
      }
      return { localId: null, name: null }
    }

    if (topic === 'products/create' || topic === 'products/update') {
      eventType =
        topic === 'products/create' ? 'SHOPIFY_PRODUCT_CREATED' : 'SHOPIFY_PRODUCT_UPDATED'
      entityType = 'product'
      var shopifyProductId = body.id ? String(body.id) : ''
      var resolved = resolveLocalEntity('product', shopifyProductId)
      entityId = resolved.localId || shopifyProductId
      payload = {
        product: {
          shopify_id: shopifyProductId,
          local_id: resolved.localId,
          name: body.title || resolved.name,
        },
        seo_title: body.seo_title || '',
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
      var invItemId = body.inventory_item_id ? String(body.inventory_item_id) : ''
      var invResolved = resolveLocalEntity('inventory', invItemId)
      entityId = invResolved.localId || invItemId
      var quantity = body.available != null ? body.available : 0
      payload = {
        inventory: { item_id: invItemId, quantity: quantity },
        product: { local_id: invResolved.localId, shopify_id: null, name: invResolved.name },
        variant: {
          local_id: invResolved.variantId,
          shopify_variant_id: invResolved.shopifyVariantId,
          sku: invResolved.sku,
        },
      }
    }

    if (!eventType) return e.json(200, { received: true })

    // Build dedup key: X-Shopify-Webhook-Id > X-Shopify-Event-Id > domain+topic+entity+updatedAt
    var updatedAt = body.updated_at || new Date().toISOString()
    var dedupKey = ''
    if (webhookId) {
      dedupKey = 'shopify:' + storeId + ':' + webhookId
    } else if (eventId) {
      dedupKey = 'shopify:' + storeId + ':' + eventId
    } else {
      dedupKey =
        'shopify:' +
        storeId +
        ':' +
        normalizedDomain +
        ':' +
        topic +
        ':' +
        entityId +
        ':' +
        updatedAt
    }

    // Dedup: check if event exists, do NOT modify original
    try {
      var existingEvent = $app.findFirstRecordByFilter(
        'automation_events',
        'deduplication_key = {:dk}',
        { dk: dedupKey },
      )
      if (existingEvent) {
        return e.json(200, { received: true, status: 'duplicate' })
      }
    } catch (_) {}

    // Create event PROCESSING
    var eventsCol = $app.findCollectionByNameOrId('automation_events')
    var eventRec = new Record(eventsCol)
    eventRec.set('store', storeId)
    eventRec.set('event_type', eventType)
    eventRec.set('source', 'shopify_webhook')
    eventRec.set('entity_type', entityType)
    eventRec.set('entity_id', entityId)
    eventRec.set('payload', JSON.stringify(payload))
    eventRec.set('deduplication_key', dedupKey)
    eventRec.set('status', 'PROCESSING')
    eventRec.set('received_at', new Date().toISOString())
    $app.save(eventRec)

    // Rule Engine: find matching rules
    var rules = []
    try {
      rules = $app.findRecordsByFilter(
        'automation_rules',
        'store = {:sid} && enabled = true && trigger_type = {:tt}',
        '-priority',
        50,
        0,
        { sid: storeId, tt: eventType },
      )
    } catch (_) {}

    function getNestedValue(obj, path) {
      var parts = path.split('.')
      var current = obj
      for (var i = 0; i < parts.length; i++) {
        if (current === null || current === undefined) return undefined
        current = current[parts[i]]
      }
      return current
    }

    function evaluateCondition(cond, p) {
      if (!cond || !cond.field) return true
      var val = getNestedValue(p, cond.field)
      switch (cond.operator) {
        case 'equals':
          return val === cond.value
        case 'not_equals':
          return val !== cond.value
        case 'greater_than':
          return Number(val) > Number(cond.value)
        case 'greater_or_equal':
          return Number(val) >= Number(cond.value)
        case 'less_than':
          return Number(val) < Number(cond.value)
        case 'less_or_equal':
          return Number(val) <= Number(cond.value)
        case 'contains':
          return String(val || '').indexOf(String(cond.value)) !== -1
        case 'not_contains':
          return String(val || '').indexOf(String(cond.value)) === -1
        case 'is_empty':
          return !val || val === '' || val === null || val === undefined
        case 'is_not_empty':
          return !!val && val !== ''
        case 'in':
          return Array.isArray(cond.value) && cond.value.indexOf(val) !== -1
        case 'not_in':
          return Array.isArray(cond.value) && cond.value.indexOf(val) === -1
        default:
          return false
      }
    }

    function evaluateConditions(conditions, p) {
      if (!conditions) return true
      if (conditions.all) {
        for (var i = 0; i < conditions.all.length; i++) {
          if (!evaluateCondition(conditions.all[i], p)) return false
        }
        return true
      }
      if (conditions.any) {
        for (var j = 0; j < conditions.any.length; j++) {
          if (evaluateCondition(conditions.any[j], p)) return true
        }
        return false
      }
      return evaluateCondition(conditions, p)
    }

    var jobsCol = $app.findCollectionByNameOrId('automation_jobs')
    var jobsCreated = 0

    for (var ri = 0; ri < rules.length; ri++) {
      var rule = rules[ri]
      var conditionsStr = rule.getString('conditions')
      var conditions = null
      try {
        conditions = JSON.parse(conditionsStr)
      } catch (_) {}

      if (!evaluateConditions(conditions, payload)) continue

      // Per-entity cooldown
      var cooldownMin = rule.getNumber('cooldown_minutes') || 0
      if (cooldownMin > 0 && entityId) {
        try {
          var lastJobs = $app.findRecordsByFilter(
            'automation_jobs',
            'rule = {:rid} && (status = {:s1} || status = {:s2})',
            '-created',
            10,
            0,
            { rid: rule.id, s1: 'COMPLETED', s2: 'WAITING_APPROVAL' },
          )
          for (var lj = 0; lj < lastJobs.length; lj++) {
            var ljEvent = $app.findRecordById('automation_events', lastJobs[lj].getString('event'))
            if (
              ljEvent.getString('entity_type') === entityType &&
              ljEvent.getString('entity_id') === entityId
            ) {
              var lastDate = new Date(lastJobs[lj].getString('created'))
              if (new Date(lastDate.getTime() + cooldownMin * 60000) > new Date()) {
                break
              }
              break
            }
          }
        } catch (_) {}
      }

      // Idempotency check
      var idempotencyKey =
        storeId +
        ':' +
        rule.id +
        ':' +
        eventRec.id +
        ':' +
        (entityId || '') +
        ':' +
        rule.getString('action_type')
      try {
        var existingJob = $app.findFirstRecordByFilter(
          'automation_jobs',
          'idempotency_key = {:ik} && status = {:st}',
          { ik: idempotencyKey, st: 'COMPLETED' },
        )
        if (existingJob) continue
      } catch (_) {}

      // Check duplicate job
      try {
        var dupJob = $app.findFirstRecordByFilter(
          'automation_jobs',
          'rule = {:rid} && event = {:eid}',
          { rid: rule.id, eid: eventRec.id },
        )
        if (dupJob) continue
      } catch (_) {}

      var jobRec = new Record(jobsCol)
      jobRec.set('store', storeId)
      jobRec.set('rule', rule.id)
      jobRec.set('event', eventRec.id)
      jobRec.set('job_type', rule.getString('action_type'))
      jobRec.set('status', 'QUEUED')
      jobRec.set('priority', rule.getNumber('priority') || 5)
      jobRec.set('payload', JSON.stringify(payload))
      jobRec.set('attempts', 0)
      jobRec.set('max_attempts', 3)
      jobRec.set('scheduled_for', new Date().toISOString())
      jobRec.set('idempotency_key', idempotencyKey)
      $app.save(jobRec)
      jobsCreated++
    }

    eventRec.set('status', 'PROCESSED')
    eventRec.set('processed_at', new Date().toISOString())
    $app.save(eventRec)

    return e.json(200, { received: true, jobsCreated: jobsCreated })
  } catch (err) {
    $app.logger().error('Shopify webhook error', 'error', String(err))
    return e.json(500, { error: 'Internal error' })
  }
})
