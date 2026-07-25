<!--
Arquivo gerado automaticamente a partir de: documentation/md/DEPENDENCIES.md
Idioma alvo: Português (Brasil)
-->
# Dependências

## Aplicativo

-bcryptjs
-jsonwebtoken
- tipos openapi
- refletir metadados
-uuid
- xss
- yaml

## Servidor infra-expresso

- expresso
- analisador de corpo
- cors
- capacete

## Infra - Servidor Fastify

- fastificar
- @fastify/cors
- @fastify/formbody
- @fastify/capacete
- @fastify/estático

## Infra - Restificar

- restificar
- bunyan

## Infra - Servidor Hyper-Express

- hiper-expresso
- diretório ao vivo

## Infra - Adaptadores HTTP/tempo de execução adicionais

- Cloudflare Workers (adaptador `fetch` sem servidor)
- Funções Vercel (adaptador sem servidor `req/res`, tipos `@vercel/node`)
- Adaptador de tempo de execução LoopBack (dependência de tempo de execução opcional `@loopback/rest`)
- Adaptador de tempo de execução Sails.js (dependência de tempo de execução opcional `sails`)
- Adaptador de tempo de execução Feathers (`@feathersjs/feathers` e `@feathersjs/koa` dependências de tempo de execução opcionais)
- Adaptador de tempo de execução Derby.js (dependência de tempo de execução opcional `derby`)
- Ponte de tempo de execução Adonis.js (dependência de tempo de execução opcional `@adonisjs/http-server`)
- Ponte de tempo de execução Total.js (dependência de tempo de execução opcional `total4`)

Esses adaptadores são projetados como pontos de integração selecionáveis ​​em tempo de execução e não requerem herança do servidor Express.

## Infra - AWS Lambda / sem servidor

- aws-lambda
- sem servidor

## Infra - Armazenamento distribuído de valores-chave

- redis
