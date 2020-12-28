'use strict'

import MsWorker from './MsWorker'

let started = false,
  worker = new MsWorker({
    sequelize: false, // require VPN connection
    mongo: true, // required for mediator,
    mediator: false,
    cassandra: false,
    jobLogReader: false // is this an worker that reads logs ?
  })

;(async function () {
  if (!started) {
    await worker.start()
    started = true
  }
})()

export default worker
