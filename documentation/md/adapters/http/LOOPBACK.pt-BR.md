<!--
Arquivo gerado automaticamente a partir de: documentation/md/adapters/http/LOOPBACK.md
Idioma alvo: Português (Brasil)
-->
# Adaptador LoopBack

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

Adapter LOOPBACK para interfaces http do Jumentix — monta use-cases sem vazar tipos de framework no domínio.

## Propósito

Execute operações de API com integração de tempo de execução LoopBack.

## Pontos de entrada

- `apps/backend-template/src/interface/HTTP/adapters/loopback/loopback.ts`

## Construa um serviço com LoopBack

1. Mantenha os contratos de negócios/casos de uso na camada de módulo.
2. Use o bootstrap do adaptador LoopBack para expor rotas/manipuladores.
3. Execute:

```bash
bun run dev:loopback
```

## Checklist júnior (“Eu consigo …”)

- [ ] Sei quando escolher este adapter
- [ ] Consigo iniciá-lo pelo script documentado
- [ ] Sei o próximo guia/pacote

## Próximo passo

Volte para [Começando](/docs/pt-BR/jumentix/concepts/getting-started) ou o guia correspondente.
