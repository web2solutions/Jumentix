# Adapters HTTP

Escolha o adapter HTTP pela forma como o serviço será executado. A regra é simples: o adapter sabe falar com o framework, mas o domínio só conhece contratos Jumentix.

## Tabela de comparação dos frameworks HTTP

| Adapter | Tecnologia integrada | Melhor uso | Runtime | Como iniciar |
| --- | --- | --- | --- | --- |
| [Express](/docs/pt-BR/jumentix/adapters/http/express) | Framework HTTP minimalista para Node.js com middlewares, routers e ecossistema amplo. | Times que querem a borda REST mais familiar e muitas opções de middleware prontas. | Processo Node/Bun de longa duração | `bun run dev:express` |
| [Fastify](/docs/pt-BR/jumentix/adapters/http/fastify) | Framework HTTP de alta performance para Node.js com encapsulamento por plugins e requests orientados a schema. | APIs com alto volume de requests, fronteiras fortes de validação e composição previsível por plugins. | Processo Node/Bun de longa duração | `bun run dev:fastify` |
| [Restify](/docs/pt-BR/jumentix/adapters/http/restify) | Framework Node.js focado em REST, desenhado para APIs de serviço e tratamento explícito de request/response. | APIs de serviço em que semântica REST explícita e clareza operacional importam mais que tamanho do ecossistema. | Processo Node/Bun de longa duração | `bun run dev:restify` |
| [AWS Lambda](/docs/pt-BR/jumentix/adapters/http/aws-lambda) | Funções serverless da AWS invocadas por API Gateway, EventBridge, filas ou chamadas diretas Lambda. | APIs orientadas a eventos, workloads com picos e times que já operam na AWS. | Invocação serverless por função | entrypoint de plataforma |
| [Cloudflare Workers](/docs/pt-BR/jumentix/adapters/http/cloudflare-workers) | Runtime de edge baseado na Web Fetch API, publicado próximo aos usuários via Cloudflare. | APIs de baixa latência no edge, gateways de autenticação e tratamento de requests alinhado ao browser. | Handler Fetch no edge | entrypoint de plataforma |
| [Vercel Functions](/docs/pt-BR/jumentix/adapters/http/vercel-functions) | Funções HTTP serverless publicadas junto de aplicações e roteamento da Vercel. | APIs próximas ao frontend, times que já publicam pela Vercel e escala por rota. | Handler serverless por request | entrypoint de plataforma |
| [LoopBack](/docs/pt-BR/jumentix/adapters/http/loopback) | Framework de API com convenções fortes de model, controller e OpenAPI. | APIs com muitos models que se beneficiam de controllers por convenção e metadados OpenAPI. | Processo Node gerenciado pelo framework | entrypoint de plataforma |
| [Sails.js](/docs/pt-BR/jumentix/adapters/http/sails-js) | Framework Node.js orientado a MVC com convenções completas. | Aplicações server com muitas convenções que precisam de endpoints REST e estrutura estilo MVC. | Processo Node gerenciado pelo framework | entrypoint de plataforma |
| [Feathers](/docs/pt-BR/jumentix/adapters/http/feathers) | Framework Node.js orientado a serviços para endpoints REST e realtime. | APIs de serviço que podem expor o mesmo comportamento por HTTP e canais realtime. | Processo Node gerenciado pelo framework | entrypoint de plataforma |
| [Derby.js](/docs/pt-BR/jumentix/adapters/http/derby-js) | Framework MVC realtime full-stack para aplicações colaborativas. | Superfícies colaborativas de produto que se beneficiam de convenções MVC realtime na borda. | Processo Node gerenciado pelo framework | entrypoint de plataforma |
| [Adonis.js](/docs/pt-BR/jumentix/adapters/http/adonis-js) | Framework web Node.js TypeScript-first com convenções fortes de aplicação. | Times que querem um framework TypeScript coeso em volta da fronteira de domínio do Jumentix. | Processo Node gerenciado pelo framework | entrypoint de plataforma |
| [Total.js](/docs/pt-BR/jumentix/adapters/http/total-js) | Framework Node.js full-stack com tooling integrado para web, API e aplicação. | Aplicações que querem uma casca de framework mais ampla mantendo os use cases Jumentix isolados. | Processo Node gerenciado pelo framework | entrypoint de plataforma |

## Guia rápido

- Use **Express** para familiaridade e compatibilidade.
- Use **Fastify** para performance, plugins e schemas.
- Use **Restify** para APIs REST de serviço explícitas.
- Use **AWS Lambda**, **Cloudflare Workers** ou **Vercel Functions** para serverless ou edge.
- Use frameworks completos quando quiser convenções maiores na borda sem contaminar o domínio.

## Exemplo completo de seleção

```ts
type HttpAdapterChoice = {
  adapter: string;
  runtime: string;
  command?: string;
};

const choices: HttpAdapterChoice[] = [
  { adapter: 'express', runtime: 'Node/Bun process', command: 'bun run dev:express' },
  { adapter: 'fastify', runtime: 'Node/Bun process', command: 'bun run dev:fastify' },
  { adapter: 'restify', runtime: 'Node/Bun process', command: 'bun run dev:restify' },
  { adapter: 'cloudflare-workers', runtime: 'Edge Fetch handler' },
  { adapter: 'aws-lambda', runtime: 'Serverless function' },
  { adapter: 'vercel-functions', runtime: 'Serverless request handler' }
];

export function chooseHttpAdapter(adapter: string): HttpAdapterChoice {
  const choice = choices.find((item) => item.adapter === adapter);

  if (!choice) {
    throw new Error('Unsupported HTTP adapter: ' + adapter);
  }

  return choice;
}
```
