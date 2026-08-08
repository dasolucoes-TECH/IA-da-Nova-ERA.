routerAdd(
  'POST',
  '/backend/v1/autopilot/approvals/{id}/approve',
  (e) => {
    try {
      var userId = e.auth ? e.auth.id : ''
      if (!userId) return e.unauthorizedError('Autenticação necessária')

      var storeRecord = null
      var memberRole = ''
      try {
        var members = $app.findRecordsByFilter('store_members', 'user = {:uid}', '-created', 1, 0, {
          uid: userId,
        })
        if (members.length > 0) {
          memberRole = members[0].getString('role')
          storeRecord = $app.findRecordById('stores', members[0].getString('store'))
        }
      } catch (_) {}
      if (!storeRecord) return e.json(403, { error: 'Nenhuma loja associada' })

      var approvalId = e.request.pathValue('id')
      var approval = $app.findRecordById('automation_approvals', approvalId)
      if (approval.getString('store') !== storeRecord.id)
        return e.json(403, { error: 'Aprovação não pertence à loja' })
      if (approval.getString('status') !== 'PENDING')
        return e.json(409, { error: 'Aprovação já processada' })

      var riskLevel = approval.getString('risk_level')
      if (memberRole === 'VIEWER') return e.json(403, { error: 'VIEWER não pode aprovar' })
      if (memberRole === 'EDITOR' && (riskLevel === 'HIGH' || riskLevel === 'CRITICAL'))
        return e.json(403, { error: 'EDITOR não pode aprovar ações HIGH/CRITICAL' })
      if (riskLevel === 'CRITICAL' && memberRole !== 'OWNER')
        return e.json(403, { error: 'CRITICAL exige OWNER' })

      var expiresAt = approval.getString('expires_at')
      if (expiresAt && new Date(expiresAt) < new Date()) {
        approval.set('status', 'EXPIRED')
        $app.save(approval)
        return e.json(410, { error: 'Aprovação expirada' })
      }

      approval.set('status', 'APPROVED')
      approval.set('approved_by', userId)
      approval.set('approved_at', new Date().toISOString())
      $app.save(approval)
      $app.logger().info('approval_approved', 'approvalId', approvalId, 'userId', userId)

      var jobId = approval.getString('job')
      if (jobId) {
        try {
          var job = $app.findRecordById('automation_jobs', jobId)
          var actionType = job.getString('job_type')
          var proposedAction = {}
          try {
            proposedAction = JSON.parse(approval.getString('proposed_action'))
          } catch (_) {}

          if (actionType === 'GENERATE_PRODUCT_SEO') {
            var productId = approval.getString('entity_id')
            if (productId) {
              var product = $app.findRecordById('products', productId)
              var seoPrompt =
                'Gere dados SEO para o produto "' +
                product.getString('name') +
                '". Descrição: ' +
                (product.getString('description') || 'N/A') +
                '. Responda em JSON: {"seo_title":"","meta_description":"","keywords":"","slug":"","alt_text":""}'
              var aiReply = $ai.chat({
                model: 'fast',
                messages: [
                  { role: 'system', content: 'Responda apenas JSON.' },
                  { role: 'user', content: seoPrompt },
                ],
              })
              var seoText = aiReply.choices[0].message.content
                .trim()
                .replace(/```json\s*/g, '')
                .replace(/```/g, '')
                .trim()
              var seoData = JSON.parse(seoText)
              product.set('seo_title', seoData.seo_title || '')
              product.set('meta_description', seoData.meta_description || '')
              product.set('keywords', seoData.keywords || '')
              product.set('slug', seoData.slug || product.getString('slug'))
              product.set('alt_text', seoData.alt_text || '')
              $app.save(product)
            }
          } else if (actionType === 'GENERATE_INSTAGRAM_CONTENT') {
            var pid = approval.getString('entity_id')
            if (pid) {
              var prod = $app.findRecordById('products', pid)
              var igPrompt =
                'Crie conteúdo de Instagram para "' +
                prod.getString('name') +
                '". Responda JSON: {"caption":"","hashtags":"","stories":"","carousel":""}'
              var igReply = $ai.chat({
                model: 'fast',
                messages: [
                  { role: 'system', content: 'Responda apenas JSON.' },
                  { role: 'user', content: igPrompt },
                ],
              })
              var igText = igReply.choices[0].message.content
                .trim()
                .replace(/```json\s*/g, '')
                .replace(/```/g, '')
                .trim()
              var igData = JSON.parse(igText)
              prod.set('instagram_caption', igData.caption || '')
              prod.set('instagram_hashtags', igData.hashtags || '')
              $app.save(prod)
            }
          }

          job.set('status', 'COMPLETED')
          job.set('completed_at', new Date().toISOString())
          job.set(
            'result',
            JSON.stringify({ approved: true, executedAt: new Date().toISOString() }),
          )
          $app.save(job)
        } catch (jobErr) {
          $app.logger().error('approval_execution_error', 'error', String(jobErr))
        }
      }

      try {
        var nCol = $app.findCollectionByNameOrId('automation_notifications')
        var nRec = new Record(nCol)
        nRec.set('store', storeRecord.id)
        nRec.set('user', userId)
        nRec.set('type', 'approval_resolved')
        nRec.set('title', 'Aprovação concluída')
        nRec.set(
          'message',
          'A ação "' + approval.getString('title') + '" foi aprovada e executada.',
        )
        nRec.set('severity', 'SUCCESS')
        nRec.set('read', false)
        $app.save(nRec)
      } catch (_) {}

      return e.json(200, { success: true, status: 'APPROVED' })
    } catch (err) {
      return e.internalServerError('Erro: ' + String(err))
    }
  },
  $apis.requireAuth(),
)
