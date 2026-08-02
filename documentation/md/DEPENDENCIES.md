# Dependencies

## Application

- bcryptjs
- jsonwebtoken
- openapi-types
- reflect-metadata
- uuid
- xss
- yaml

## Infra - Express server

- express
- body-parser
- cors
- helmet

## Infra - Fastify server

- fastify
- @fastify/cors
- @fastify/formbody
- @fastify/helmet
- @fastify/static

## Infra - Restify

- restify
- bunyan

## Infra - Additional HTTP/runtime adapters

- Cloudflare Workers (serverless `fetch` adapter)
- Vercel Functions (`req/res` serverless adapter, `@vercel/node` types)
- LoopBack runtime adapter (`@loopback/rest` required when that adapter is activated)
- Sails.js runtime adapter (`sails` required when that adapter is activated)
- Feathers runtime adapter (`@feathersjs/feathers` and `@feathersjs/koa` required when that adapter is activated)
- Derby.js runtime adapter (`derby` required when that adapter is activated)
- Adonis.js runtime bridge (`@adonisjs/http-server` required when that adapter is activated)
- Total.js runtime bridge (`total4` required when that adapter is activated)

These adapters are designed as runtime-selectable integration points and do not require Express server inheritance. Framework-named adapters must declare and import their real framework dependency before they can be treated as implemented. Hyper-Express is not a supported target in the current `dev` baseline.

## Infra - AWS Lambda / serverless

- aws-lambda
- serverless

## Infra - Distributed key-value storage

- redis
