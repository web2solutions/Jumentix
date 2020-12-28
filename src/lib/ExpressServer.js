'use strict'

import * as ExpressGeneralMiddlewares from './express'
import * as PassportIntegration from './auth/services/router.service'
import * as SwaggerIntegration from './swagger'
import express from 'express'
import http from 'http'
// import swaggerTools from 'swagger-tools'

// import { generic404, genericErrorHandler } from './response'

// mixin
const ExpressServer = (ExpressServer) =>
  class extends ExpressServer {
    async startExpress (c) {
      const error = false
      c = c || {}
      try {
        this.webapp = null
        this.io = null
        // this.port = this.config.app.server.port

        this.createWebServer()
        const ssr = await this.startServer()
        if (ssr.error) {
          return { error: ssr.error }
        }
        if (c.io) {
          const mr = await this.startMediator()
          if (mr.error) {
            return { error: mr.error }
          }
        }

        return { error }
      } catch (e) {
        console.log(e)
        this.console.warn('error starting Express', e)
        return { error: e }
      }
    }

    createWebServer () {
      this.webapp = express()
      this.server = http.Server(this.webapp)
    }

    listenServer () {
      const self = this
      const error = false
      return new Promise(function (resolve, reject) {
        try {
          self.server.listen(self.config.app.server.port, () => {
            self.console.info(
              ' Webserver is ready and listening to port *: ' +
                self.config.app.server.port
            )
            resolve({ error })
          })
        } catch (e) {
          // statements
          console.log(e)
          reject(Error({ error: e }))
        }
      })
    }

    async startServer () {
      const self = this
      let error = false
      try {
        // Express
        const em = await ExpressGeneralMiddlewares.start(self.webapp, self)
        if (em.error) {
          return { error: em.error }
        }

        // PassportIntegration
        const pi = await PassportIntegration.start(self.webapp, self)
        if (pi.error) {
          return { error: pi.error }
        }

        // Swagger
        const si = await SwaggerIntegration.start(self.webapp, self)
        if (si.error) {
          return { error: si.error }
        }
        await this.listenServer()
      } catch (err) {
        error = err
      }

      return { error }
    }
  }

export default ExpressServer
