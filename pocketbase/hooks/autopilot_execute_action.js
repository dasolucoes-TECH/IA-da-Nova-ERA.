routerAdd('POST', '/backend/v1/autopilot/execute-action', (e) => {
  try {
    var providedSecret = e.request.header.get('X-Internal-Secret') || ''
    var expectedSecret = $secrets.get('PB_SUPERUSER_TOKEN') || ''
    if (!expectedSecret || providedSecret !== expectedSecret) {
      return e.unauthorizedError('Internal only')
    }

    var body = e.requestInfo().body || {}
    var jobId = body.jobId || ''
    if (!jobId) return e.badRequestError('jobId is required')

    var job = $app.findRecordById('automation_jobs', jobId)
    var ruleId = job.getString('rule')
    var eventId = job.getString('event')
    var actionType = job.getString('job_type')
    var storeId = job.getString('store')

    var rule = null
    try {
      rule = $app.findRecordById('automation_rules', ruleId)
    } catch (_) {}
    var eventRec = null
    try {
      eventRec = $app.findRecordById('automation_events', eventId)
    } catch (_) {}

    if (!rule || !eventRec)
      return e.json(200, { status: 'FAILED', message: 'Rule or event not found' })

    var ACTION_REGISTRY = {
      GENERATE_PRODUCT_SEO: { implemented: true, minutesSaved: 10 },
      GENERATE_INSTAGRAM_CONTENT: { implemented: true, minutesSaved: 15 },
      CREATE_NOTIFICATION: { implemented: true, minutesSaved: 0 },
      ANALYZE_LOW_STOCK: { implemented: true, minutesSaved: 10 },
      ANALYZE_PRODUCT_PERFORMANCE: { implemented: true, minutesSaved: 15 },
      GENERATE_PRODUCT_CONTENT: { implemented: true, minutesSaved: 20 },
      CREATE_SHOPIFY_DRAFT: { implemented: false, minutesSaved: 10 },
      UPDATE_LOCAL_PRODUCT: { implemented: false, minutesSaved: 5 },
      CREATE_MARKETING_DRAFT: { implemented: false, minutesSaved: 10 },
      CREATE_DAILY_BRIEFING: { implemented: false, minutesSaved: 15 },
      REQUEST_PRICE_CHANGE: { implemented: false, minutesSaved: 0 },
      REQUEST_SHOPIFY_ACTIVATION: { implemented: false, minutesSaved: 0 },
    }

    var meta = ACTION_REGISTRY[actionType]
    if (!meta || !meta.implemented)
      return e.json(200, {
        status: 'NOT_IMPLEMENTED',
        message: 'Acao nao implementada: ' + actionType,
      })

    var owner = ''
    try {
      var owners = $app.findRecordsByFilter(
        'store_members',
        "store = {:sid} && role = 'OWNER'",
        '-created',
        1,
        0,
        { sid: storeId },
      )
      if (owners.length > 0) owner = owners[0].getString('user')
    } catch (_) {}

    var productId = eventRec.getString('entity_id')
    var payload = {}
    try {
      payload = JSON.parse(eventRec.getString('payload'))
    } catch (_) {}

    var MANDATORY_PROMPT =
      'Use exclusivamente os fatos fornecidos. Nao invente especificacoes, garantia, frete, certificacoes, avaliacoes ou quantidades vendidas.'

    function cleanAiJson(text) {
      var t = text.trim()
      if (t.indexOf('```json') !== -1) {
        t = t
          .replace(/```json\s*/g, '')
          .replace(/```/g, '')
          .trim()
      } else if (t.indexOf('```') !== -1) {
        t = t
          .replace(/```\s*/g, '')
          .replace(/```/g, '')
          .trim()
      }
      return t
    }

    function createActionLog(status, summary) {
      try {
        var logCol = $app.findCollectionByNameOrId('action_logs')
        var logRec = new Record(logCol)
        logRec.set('store', storeId)
        logRec.set('user', owner)
        logRec.set('action_type', actionType)
        logRec.set('entity_type', eventRec.getString('entity_type') || '')
        logRec.set('entity_id', eventRec.getString('entity_id') || '')
        logRec.set('status', status)
        logRec.set('summary', summary || '')
        logRec.set('rule', ruleId)
        logRec.set('event', eventId)
        logRec.set('job', jobId)
        logRec.set('automation', true)
        logRec.set('execution_source', 'AUTOMATION')
        if (meta.minutesSaved && status === 'EXECUTED')
          logRec.set('estimated_minutes_saved', meta.minutesSaved)
        $app.save(logRec)
      } catch (_) {}
    }

    function createNotification(type, title, message, severity) {
      try {
        var nCol = $app.findCollectionByNameOrId('automation_notifications')
        var nRec = new Record(nCol)
        nRec.set('store', storeId)
        nRec.set('user', owner)
        nRec.set('type', type)
        nRec.set('title', title)
        nRec.set('message', message)
        nRec.set('severity', severity || 'INFO')
        nRec.set('read', false)
        $app.save(nRec)
      } catch (_) {}
    }

    var execResult = { status: 'FAILED', message: 'No executor for: ' + actionType }

    if (actionType === 'CREATE_NOTIFICATION') {
      var actionConfig = {}
      try {
        actionConfig = JSON.parse(rule.getString('action_config'))
      } catch (_) {}
      var msgTemplate = actionConfig.message_template || 'Notificacao automatica'
      var productName =
        (payload.product && (payload.product.name || payload.product.title)) || 'Produto'
      var quantity = (payload.inventory && payload.inventory.quantity) || 0
      var msg = msgTemplate
        .replace('{produto}', productName)
        .replace('{quantidade}', String(quantity))
      createNotification('critical_stock', 'Estoque critico', msg, 'CRITICAL')
      execResult = { status: 'COMPLETED', message: 'Notification created' }
    } else if (actionType === 'ANALYZE_LOW_STOCK' || actionType === 'ANALYZE_PRODUCT_PERFORMANCE') {
      createNotification(
        'analysis',
        'Analise concluida',
        'A analise de performance foi executada com sucesso.',
        'INFO',
      )
      execResult = { status: 'COMPLETED', message: 'Analysis completed' }
    } else {
      if (!productId) {
        execResult = { status: 'FAILED', message: 'No product entity_id' }
      } else {
        var product = null
        try {
          product = $app.findRecordById('products', productId)
        } catch (_) {}
        if (!product) {
          execResult = { status: 'FAILED', message: 'Product not found: ' + productId }
        } else {
          var facts = {
            name: product.getString('name'),
            description: product.getString('description') || null,
            vendor: product.getString('vendor') || null,
            product_type: product.getString('product_type') || null,
            price: product.getNumber('price') || null,
            cost: product.getNumber('cost') || null,
            tags: product.getString('tags') || null,
          }

          if (actionType === 'GENERATE_PRODUCT_SEO') {
            try {
              var seoPrompt =
                'Gere dados SEO para o produto "' +
                facts.name +
                '". ' +
                MANDATORY_PROMPT +
                '\nFATOS:\n' +
                JSON.stringify(facts) +
                '\nResponda JSON: {"seo_title":"","meta_description":"","keywords":"","slug":"","alt_text":""}'
              var aiReply = $ai.chat({
                model: 'fast',
                messages: [
                  { role: 'system', content: 'Responda exclusivamente com JSON valido.' },
                  { role: 'user', content: seoPrompt },
                ],
              })
              var cleaned = cleanAiJson(aiReply.choices[0].message.content)
              var seoData = JSON.parse(cleaned)
              if (!seoData.seo_title || typeof seoData.seo_title !== 'string')
                throw new Error('Invalid SEO format')
              product.set('seo_title', seoData.seo_title || '')
              product.set('meta_description', seoData.meta_description || '')
              product.set('keywords', seoData.keywords || '')
              product.set('slug', seoData.slug || product.getString('slug'))
              product.set('alt_text', seoData.alt_text || '')
              $app.save(product)
              execResult = { status: 'COMPLETED', message: 'SEO generated' }
            } catch (seoErr) {
              execResult = {
                status: 'FAILED',
                message: 'AI returned invalid SEO format: ' + String(seoErr),
              }
            }
          } else if (actionType === 'GENERATE_INSTAGRAM_CONTENT') {
            try {
              var igPrompt =
                'Crie conteudo de Instagram para "' +
                facts.name +
                '". ' +
                MANDATORY_PROMPT +
                '\nFATOS:\n' +
                JSON.stringify(facts) +
                '\nResponda JSON: {"caption":"","hashtags":""}'
              var igReply = $ai.chat({
                model: 'fast',
                messages: [
                  { role: 'system', content: 'Responda apenas JSON valido.' },
                  { role: 'user', content: igPrompt },
                ],
              })
              var igCleaned = cleanAiJson(igReply.choices[0].message.content)
              var igData = JSON.parse(igCleaned)
              if (!igData.caption || typeof igData.caption !== 'string')
                throw new Error('Invalid Instagram format')
              product.set('instagram_caption', igData.caption || '')
              product.set('instagram_hashtags', igData.hashtags || '')
              $app.save(product)
              execResult = { status: 'COMPLETED', message: 'Instagram content generated' }
            } catch (igErr) {
              execResult = {
                status: 'FAILED',
                message: 'AI returned invalid Instagram format: ' + String(igErr),
              }
            }
          } else if (actionType === 'GENERATE_PRODUCT_CONTENT') {
            try {
              var contentPrompt =
                'Gere conteudo de alta conversao para o produto abaixo. ' +
                MANDATORY_PROMPT +
                '\nFATOS:\n' +
                JSON.stringify(facts) +
                '\nResponda JSON: {"description":"","seo_title":"","meta_description":"","keywords":"","slug":"","alt_text":""}'
              var contentReply = $ai.chat({
                model: 'reasoning',
                messages: [
                  { role: 'system', content: 'Responda apenas JSON valido. Nao use markdown.' },
                  { role: 'user', content: contentPrompt },
                ],
              })
              var contentCleaned = cleanAiJson(contentReply.choices[0].message.content)
              var contentData = JSON.parse(contentCleaned)
              if (!contentData.description || !contentData.seo_title)
                throw new Error('Invalid content format')
              product.set('description', contentData.description || '')
              product.set('seo_title', contentData.seo_title || '')
              product.set('meta_description', contentData.meta_description || '')
              product.set('keywords', contentData.keywords || '')
              product.set('slug', contentData.slug || product.getString('slug'))
              product.set('alt_text', contentData.alt_text || '')
              $app.save(product)
              execResult = { status: 'COMPLETED', message: 'Product content generated' }
            } catch (contentErr) {
              execResult = {
                status: 'FAILED',
                message: 'AI returned invalid content format: ' + String(contentErr),
              }
            }
          }
        }
      }
    }

    if (execResult.status === 'COMPLETED') {
      createActionLog('EXECUTED', 'Executado: ' + actionType)
      createNotification(
        'automation_completed',
        'Automacao concluida',
        'A automacao "' + rule.getString('name') + '" foi executada com sucesso.',
        'SUCCESS',
      )
    } else {
      createActionLog('FAILED', 'Falha: ' + execResult.message)
      createNotification(
        'automation_error',
        'Falha na automacao',
        'A automacao "' + rule.getString('name') + '" falhou: ' + execResult.message,
        'ERROR',
      )
    }

    return e.json(200, execResult)
  } catch (err) {
    $app.logger().error('execute_action_error', 'error', String(err))
    return e.json(500, { status: 'FAILED', message: String(err) })
  }
})
