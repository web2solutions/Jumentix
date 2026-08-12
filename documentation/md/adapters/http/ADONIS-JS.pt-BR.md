<!--
Arquivo gerado automaticamente a partir de: documentation/md/adapters/http/ADONIS-JS.md
Idioma alvo: Português (Brasil)
-->
# Adaptador Adonis.js

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

Adapter ADONIS JS para interfaces http do Jumentix — monta use-cases sem vazar tipos de framework no domínio.

## Propósito

Exponha as operações da API por meio da ponte de tempo de execução Adonis.js.

## Pontos de entrada

- `apps/backend-template/src/interface/HTTP/adapters/adonis-js/adonis-js.ts`

## Construa um serviço com Adonis.js

1. Mantenha os módulos independentes da estrutura.
2. Faça a ponte entre o tratamento de solicitações do Adonis e as operações do controlador.
3. Execute:

```bash
bun run dev:adonis-js
```

## Checklist júnior (“Eu consigo …”)

- [ ] Sei quando escolher este adapter
- [ ] Consigo iniciá-lo pelo script documentado
- [ ] Sei o próximo guia/pacote

## Próximo passo

Volte para [Começando](/docs/pt-BR/jumentix/concepts/getting-started) ou o guia correspondente.
