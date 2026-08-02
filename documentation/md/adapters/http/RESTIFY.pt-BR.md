<!--
Arquivo gerado automaticamente a partir de: documentation/md/adapters/http/RESTIFY.md
Idioma alvo: Português (Brasil)
-->
# Adaptador Restify

## Propósito

Use Restify como adaptador REST onde o comportamento de middleware/tempo de execução Restify é necessário.

## Pontos de entrada

- `apps/backend-template/src/interface/HTTP/adapters/restify/restify.ts`
- `apps/backend-template/src/interface/HTTP/adapters/start-rest-api.ts`

## Construa um serviço com Restify

1. Implementar controladores de operação e casos de uso.
2. Implemente o mapeamento do manipulador Restify na pasta da estrutura da interface do módulo.
3. Execute:

```bash
bun run dev:restify
```

## Produção

```bash
bun run prod:restify
```


