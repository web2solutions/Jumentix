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

## Infra - Adaptadores HTTP/tempo de execução adicionais

- Cloudflare Workers (adaptador `fetch` sem servidor)
- Funções Vercel (adaptador sem servidor `req/res`, tipos `@vercel/node`)
- Adaptador de tempo de execução LoopBack (`@loopback/rest` exigido quando esse adapter for ativado)
- Adaptador de tempo de execução Sails.js (`sails` exigido quando esse adapter for ativado)
- Adaptador de tempo de execução Feathers (`@feathersjs/feathers` e `@feathersjs/koa` exigidos quando esse adapter for ativado)
- Adaptador de tempo de execução Derby.js (`derby` exigido quando esse adapter for ativado)
- Ponte de tempo de execução Adonis.js (`@adonisjs/http-server` exigido quando esse adapter for ativado)
- Ponte de tempo de execução Total.js (`total4` exigido quando esse adapter for ativado)

Esses adaptadores são projetados como pontos de integração selecionáveis em tempo de execução e não requerem herança do servidor Express. Adapters nomeados por framework devem declarar e importar sua dependência real antes de serem tratados como implementados. Hyper-Express não é alvo suportado no baseline atual de `dev`.

## Infra - AWS Lambda / sem servidor

- aws-lambda
- sem servidor

## Infra - Armazenamento distribuído de valores-chave

- redis
