'use strict'

// import * as cassandra from 'express-cassandra'
import cassandra from 'express-cassandra'

// mixin
const CassandraClient = (CassandraClient) =>
  class extends CassandraClient {
    startCassandra () {
      const self = this
      const response = {
        error: null,
        cassandra: null
      }
      return new Promise((resolve, reject) => {
        try {
          self.console.info(' Starting CassandraDB Client')
          cassandra.setDirectory(`${this.config.app.base}/models/cassandra`).bind(this.config.cassandra,
            (err) => {
              if (err) {
                self.console.warn(
                  `CassandraDB-> connection error: ${err} details->${err}`
                )
                response.cassandra = null
                response.error = err
                resolve(response)
                return
              }
              self.$cassandra = cassandra
              self.console.info(' CassandraDB Client is ready')
              response.cassandra = cassandra

              /* const john = new self.$cassandra.instance.Person({
                name: 'John',
                surname: 'Doe',
                age: 32,
                created: Date.now()
              })
              john.save(function (err) {
                if (err) {
                  console.log(err)
                  return
                }
                console.log('Yuppiie!')
              }) */

              resolve(response)
            }
          )
        } catch (e) {
          self.console.warn(
            `CassandraDB-> connection error: ${e} details->${e}`
          )
          response.cassandra = null
          response.error = e
          resolve(response)
        }
      })
    }

    async stopCassandraDB () {
      const response = {
        error: null
      }
      try {
        this.console.info(' CassandraDB Client is stopped')
        return response
      } catch (e) {
        this.console.warn(`${e}`)
        response.error = e
        return response
      }
    }
  }

export default CassandraClient
