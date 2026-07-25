<!--
Arquivo gerado automaticamente a partir de: documentation/md/adapters/http/FASTIFY.md
Idioma alvo: Português (Brasil)
-->
# Fastify Adaptador

## Propósito

Use o Fastify como seu adaptador de entrada REST com recursos de servidor nativos do Fastify.

## Pontos de entrada

- `apps/backend-template/src/interface/HTTP/adapters/fastify/fastify.ts`
- `apps/backend-template/src/interface/HTTP/adapters/start-rest-api.ts`

## Crie um serviço com Fastify

1. Mantenha a lógica de negócios em domínios/casos de uso.
2. Implemente os manipuladores Fastify na pasta da estrutura da interface do módulo.
3. Execute:

```bash
pnpm run dev:fastify
```

## Produção

```bash
pnpm run prod:fastify
```


