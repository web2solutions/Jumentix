<!--
Arquivo gerado automaticamente a partir de: documentation/md/adapters/databases/INMEMORY.md
Idioma alvo: Português (Brasil)
-->
# Adaptador de banco de dados InMemory

## Glossário

- **Adapter de entrada** — aceita chamadas de protocolo externo e traduz para use-cases.

## Responsabilidade no escopo

- **Camada:** adapter / databases
- **Responsável por:** wiring específico deste framework/tecnologia
- **Usado com:** composição do backend-template, pacotes de persistência/SDK, guia correspondente
- **Não responsável por:** regras de domínio, autoría OpenAPI ou storage offline no browser

## Por que existe

A escolha de framework fica na borda. Este adapter mantém detalhes Express/Fastify/DB/realtime substituíveis.

## O que é

Adapter INMEMORY para interfaces databases do Jumentix — monta use-cases sem vazar tipos de framework no domínio.

## Propósito

Adaptador oficial padrão para desenvolvimento local e testes determinísticos.

## Pontos de entrada

- `apps/backend-template/src/infra/persistence/InMemoryDatabase/InMemoryDbClient.ts`
- `apps/backend-template/src/infra/persistence/compileDatabaseClient.ts`

## Crie serviços com InMemory

1. Definir ambiente:

```bash
JUMENTIX_DATABASE_DRIVER=InMemory
```

2. Inicie o adaptador API.
3. Os repositórios usarão o contrato `dbClient.stores`.

## Checklist júnior (“Eu consigo …”)

- [ ] Sei quando escolher este adapter
- [ ] Consigo iniciá-lo pelo script documentado
- [ ] Sei o próximo guia/pacote

## Próximo passo

Volte para [Começando](/docs/pt-BR/jumentix/concepts/getting-started) ou o guia correspondente.
