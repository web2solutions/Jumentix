'use strict'

import MsRESTAPI from './MsRESTAPI'

let started = false
/** new MsWorker({
        sequelize: false, // require VPN connection
        mongo: true,
        mediator: false
    }),
app = new MediatorServer({
        sequelize: false, // require VPN connection
        mongo: true,// required for mediator,
        mediator: true
}), */
const app = new MsRESTAPI({
  sequelize: false, // require VPN connection
  mongo: true, // required for mediator,
  mediator: true,
  cassandra: false,
  elastic: true,
  jobLogReader: false // is this an worker that reads logs ? set to false if it is an API
})

  ; (async () => { started = await app.start() })()

export default app
