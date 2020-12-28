import swaggerTools from 'swagger-tools'
import express from 'express'
import path from 'path'
import YAML from 'yamljs'
// import wrap from 'express-async-wrap';
import { mw } from '../auth/services/mw.service'
import { genericErrorHandler, generic404, error } from '../response'
import { Setup } from '../api/controllers/Setup'

export function start(webapp, application) {
  return new Promise(async (resolve, reject) => {
    let error = false
    let swaggerConfig = await require('./config').default(webapp, application)
    let routerConfig = {
      controllers: [
        `${application.config.app.base}/api/controllers`,
        `${application.config.app.base}/auth/controllers`
      ],
      useStubs: false // If you want use examples.
    }
    swaggerTools.initializeMiddleware(swaggerConfig, (middleware) => {
      try {
        // Interpret Swagger resources and attach metadata to request - must be first in swagger-tools middleware chain
        webapp.use(middleware.swaggerMetadata())

        // Provide the security handlers
        webapp.use(middleware.swaggerSecurity({ Bearer: mw }))

        // Validate Swagger requests
        webapp.use(
          middleware.swaggerValidator({
            validateResponse: false
          })
        )

        // Route validated requests to appropriate controller
        webapp.use(middleware.swaggerRouter(routerConfig))

        router(webapp, application, swaggerConfig)

        // Serve the Swagger documents and Swagger UI
        //   http://localhost:8000/docs => Swagger UI
        //   http://localhost:8000/api-docs => Swagger document
        // console.log('XXXCCCCCCCC', path.join(__dirname, './ui'))
        webapp.use(
          middleware.swaggerUi({
            apiDocs: '/api-docs',
            swaggerUi: '/docs',
            swaggerUiDir: path.join(__dirname, './ui')
          })
        )

        // install extra middleware

        webapp.get('/application/setup', Setup)

        webapp.use(generic404)
        webapp.use(genericErrorHandler)

        resolve({ error })
      } catch (e) {
        // statements
        console.log(e)
        resolve({ error: e })
      }
    })
  })
}

function router(webapp, application, swaggerConfig) {
  // Remove Routers from /docs with property x-hide: true

  try {
    Object.keys(swaggerConfig.paths).forEach((keyParent, i) => {
      let parent = swaggerConfig.paths[keyParent]
      Object.keys(parent).forEach((keyChild, j) => {
        let child = swaggerConfig.paths[keyParent][keyChild]

        if (
          typeof child === 'object' &&
          'x-hide' in child &&
          child['x-hide'] === true
        ) {
          delete swaggerConfig.paths[keyParent][keyChild]
        }
      })
    })

    // If Swagger is enabled then the router is enabled!
    if (application.config.app.swagger.enabled) {
      webapp.get(`/swagger.json`, (req, res) => res.json(swaggerConfig))
      webapp.use(
        '/docs',
        express.static(`${application.config.app.base}/lib/swagger/ui`)
      )
    }
  } catch (e) {
    console.log('>>>>>>>>>', e)
  }
}
