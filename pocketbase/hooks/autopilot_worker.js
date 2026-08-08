cronAdd('autopilot_worker', '* * * * *', () => {
  try {
    var now = new Date().toISOString()
    var stores = $app.findRecordsByFilter('stores', 'autopilot_enabled = true', '-created', 100, 0)

    for (var si = 0; si < stores.length; si++) {
      var storeRecord = stores[si]
      var storeId = storeRecord.id

      var jobs = []
      try {
        jobs = $app.findRecordsByFilter(
          'automation_jobs',
          'store = {:sid} && (status = {:s1} || status = {:s2}) && scheduled_for <= {:now}',
          '-priority,created',
          10,
          0,
          { sid: storeId, s1: 'QUEUED', s2: 'RETRYING', now: now },
        )
      } catch (_) {
        try {
          jobs = $app.findRecordsByFilter(
            'automation_jobs',
            'store = {:sid} && (status = {:s1} || status = {:s2})',
            '-priority,created',
            10,
            0,
            { sid: storeId, s1: 'QUEUED', s2: 'RETRYING' },
          )
          jobs = jobs.filter(function (j) {
            var sf = j.getString('scheduled_for')
            if (!sf) return true
            return new Date(sf) <= new Date(now)
          })
        } catch (_2) {}
      }

      for (var i = 0; i < jobs.length; i++) {
        var job = jobs[i]
        var currentStatus = job.getString('status')
        if (currentStatus !== 'QUEUED' && currentStatus !== 'RETRYING') continue

        try {
          $app.runInTransaction(function (txApp) {
            var txJob = txApp.findRecordById('automation_jobs', job.id)
            var txStatus = txJob.getString('status')
            if (txStatus !== 'QUEUED' && txStatus !== 'RETRYING') {
              throw new Error('already acquired')
            }
            txJob.set('status', 'RUNNING')
            txJob.set('started_at', now)
            txJob.set('attempts', (txJob.getNumber('attempts') || 0) + 1)
            txApp.save(txJob)
          })
        } catch (_) {
          continue
        }

        try {
          $app.send('POST', '/backend/v1/autopilot/process-jobs', {
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ worker: true, storeId: storeId, jobId: job.id }),
          })
        } catch (err) {
          $app.logger().error('autopilot_worker_job_error', 'jobId', job.id, 'error', String(err))
        }
      }
    }
  } catch (err) {
    $app.logger().error('autopilot_worker_error', 'error', String(err))
  }
})
