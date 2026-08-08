routerAdd(
  'POST',
  '/backend/v1/autopilot/approvals/{id}/reject',
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
      if (memberRole === 'VIEWER') return e.json(403, { error: 'VIEWER não pode rejeitar' })

      var approvalId = e.request.pathValue('id')
      var approval = $app.findRecordById('automation_approvals', approvalId)
      if (approval.getString('store') !== storeRecord.id)
        return e.json(403, { error: 'Aprovação não pertence à loja' })
      if (approval.getString('status') !== 'PENDING')
        return e.json(409, { error: 'Aprovação já processada' })

      approval.set('status', 'REJECTED')
      approval.set('approved_by', userId)
      approval.set('rejected_at', new Date().toISOString())
      $app.save(approval)
      $app.logger().info('approval_rejected', 'approvalId', approvalId, 'userId', userId)

      var jobId = approval.getString('job')
      if (jobId) {
        try {
          var job = $app.findRecordById('automation_jobs', jobId)
          job.set('status', 'CANCELLED')
          job.set('completed_at', new Date().toISOString())
          $app.save(job)
        } catch (_) {}
      }

      return e.json(200, { success: true, status: 'REJECTED' })
    } catch (err) {
      return e.internalServerError('Erro: ' + String(err))
    }
  },
  $apis.requireAuth(),
)
