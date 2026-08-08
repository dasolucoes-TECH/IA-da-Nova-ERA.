routerAdd(
  'GET',
  '/backend/v1/autopilot/approvals',
  (e) => {
    try {
      var userId = e.auth ? e.auth.id : ''
      if (!userId) return e.unauthorizedError('Autenticação necessária')

      var storeRecord = null
      try {
        var members = $app.findRecordsByFilter('store_members', 'user = {:uid}', '-created', 1, 0, {
          uid: userId,
        })
        if (members.length > 0)
          storeRecord = $app.findRecordById('stores', members[0].getString('store'))
      } catch (_) {}
      if (!storeRecord) return e.json(403, { error: 'Nenhuma loja associada' })

      var statusFilter =
        e.requestInfo().query && e.requestInfo().query.status
          ? e.requestInfo().query.status
          : 'PENDING'
      var approvals = $app.findRecordsByFilter(
        'automation_approvals',
        'store = {:sid} && status = {:st}',
        '-created',
        50,
        0,
        { sid: storeRecord.id, st: statusFilter },
      )
      var items = []
      for (var i = 0; i < approvals.length; i++) {
        var a = approvals[i]
        var proposedAction = {}
        try {
          proposedAction = JSON.parse(a.getString('proposed_action'))
        } catch (_) {}
        items.push({
          id: a.id,
          title: a.getString('title'),
          description: a.getString('description'),
          entity_type: a.getString('entity_type'),
          entity_id: a.getString('entity_id'),
          proposed_action: proposedAction,
          risk_level: a.getString('risk_level'),
          status: a.getString('status'),
          expires_at: a.getString('expires_at'),
          approved_at: a.getString('approved_at'),
          rejected_at: a.getString('rejected_at'),
          created: a.getString('created'),
          rule: a.getString('rule'),
          job: a.getString('job'),
        })
      }
      return e.json(200, { items: items })
    } catch (err) {
      return e.internalServerError('Erro: ' + String(err))
    }
  },
  $apis.requireAuth(),
)
