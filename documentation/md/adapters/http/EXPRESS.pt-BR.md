<!--
Arquivo gerado automaticamente a partir de: documentation/md/adapters/http/EXPRESS.md
Idioma alvo: Português (Brasil)
-->
# Adaptador Expresso

## Propósito

Use Express como seu adaptador de entrada REST.

## Pontos de entrada

- `apps/backend-template/src/interface/HTTP/adapters/express/express.ts`
- `apps/backend-template/src/interface/HTTP/adapters/start-rest-api.ts` (bootstrap orientado ao ambiente)

## Crie um serviço com Express

1. Implementar domínio/casos de uso/controladores em módulos.
2. Adicione manipuladores de estrutura para operações na camada de interface do módulo.
3. Comece com:

```bash
bun run dev:express
```

## Produção

```bash
bun run prod:express
```


