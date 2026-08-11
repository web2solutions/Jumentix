<!--
Arquivo gerado automaticamente a partir de: documentation/md/adapters/http/SAILS-JS.md
Idioma alvo: Português (Brasil)
-->
# Adaptador Sails.js

## Glossário

- **Adapter de entrada** — aceita chamadas de protocolo externo e traduz para use-cases.

## Responsabilidade no escopo

- **Camada:** adapter / http
- **Responsável por:** wiring específico deste framework/tecnologia
- **Usado com:** composição do backend-template, pacotes de persistência/SDK, guia correspondente
- **Não responsável por:** regras de domínio, autoría OpenAPI ou storage offline no browser

## Por que existe

A escolha de framework fica na borda. Este adapter mantém detalhes Express/Fastify/DB/realtime substituíveis.

## O que é

Adapter SAILS JS para interfaces http do Jumentix — monta use-cases sem vazar tipos de framework no domínio.

## Propósito

Use o tempo de execução Sails.js como interface de entrada HTTP.

## Pontos de entrada

- `apps/backend-template/src/interface/HTTP/adapters/sails-js/sails-js.ts`

## Construa um serviço com Sails.js

1. Mantenha domínio e casos de uso independentes da estrutura.
2. Implemente manipuladores de estrutura Sails.js.
3. Execute:

```bash
bun run dev:sails-js
```

## Checklist júnior (“Eu consigo …”)

- [ ] Sei quando escolher este adapter
- [ ] Consigo iniciá-lo pelo script documentado
- [ ] Sei o próximo guia/pacote

## Próximo passo

Volte para [Começando](/docs/pt-BR/jumentix/concepts/getting-started) ou o guia correspondente.
