<!--
Arquivo gerado automaticamente a partir de: documentation/md/adapters/http/TOTAL-JS.md
Idioma alvo: Português (Brasil)
-->
# Adaptador Total.js

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

Adapter TOTAL JS para interfaces http do Jumentix — monta use-cases sem vazar tipos de framework no domínio.

## Propósito

Use a ponte de tempo de execução Total.js como adaptador de entrada HTTP.

## Pontos de entrada

- `apps/backend-template/src/interface/HTTP/adapters/total-js/total-js.ts`

## Construa um serviço com Total.js

1. Implementar operações de módulo em controladores/casos de uso.
2. Vincule rotas/manipuladores Total.js a essas operações.
3. Execute:

```bash
bun run dev:total-js
```

## Checklist júnior (“Eu consigo …”)

- [ ] Sei quando escolher este adapter
- [ ] Consigo iniciá-lo pelo script documentado
- [ ] Sei o próximo guia/pacote

## Próximo passo

Volte para [Começando](/docs/pt-BR/jumentix/concepts/getting-started) ou o guia correspondente.
