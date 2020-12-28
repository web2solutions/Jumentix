import swaggerJSDoc from 'swagger-jsdoc'

export default (webapp, application) => {
  // Initialize Swagger
  let options = {
    swaggerDefinition: {
      swagger: '2.0',
      info: application.config.app.swagger.info,
      basePath: `/`,
      schemes: ['http', 'https'],
      securityDefinitions: {
        Bearer: {
          type: 'apiKey',
          name: 'Authorization',
          in: 'header',
          description:
            'The following syntax must be used in the "Authorization" header xxxxxx.yyyyyyy.zzzzzz'
        } /* ,
                OAuth2 :
                {
                    type : 'oauth2',
                    flow : 'implicit',
                    authorizationUrl : `http://${application.config.app.server.ip}:${application.config.app.server.port}/auth/github`,
                    // tokenUrl: `http://${application.config.app.server.ip}:${application.config.app.server.port}/#/token`,
                    description : 'Copy the generated token value in the url, and paste it into "Api key authorization"'
                }*/
      }
    },
    consumes: ['application/json'],
    produces: ['application/json'],
    apis: [
      `${application.config.app.base}/auth/**/*.yaml`,
      `${application.config.app.base}/api/**/*.yaml`
    ]
  }

  return swaggerJSDoc(options)

  // If you want use Swagger into .js = ${application.config.app.base}/**/*.js
  /**
   * @swagger
   * definitions:
   *   Example:
   *     properties:
   *       field1:
   *         type: string
   *       field2:
   *         type: string
   */

  /**
   * @swagger
   * /api/example:
   *   get:
   *     tags:
   *       - Example
   *     description: Returns all Example's
   *     produces:
   *       - application/json
   *     responses:
   *       200:
   *         description: An array of Example's
   *         schema:
   *           type: array
   *           items:
   *            $ref: '/definitions/Example'
   *       500:
   *         description: Invalid status value
   */
}
