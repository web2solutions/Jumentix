<!--
Arquivo gerado automaticamente a partir de: documentation/md/adapters/databases/MSSQL.md
Idioma alvo: Português (Brasil)
-->
# Adaptador SQL Server

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

Adapter MSSQL para interfaces databases do Jumentix — monta use-cases sem vazar tipos de framework no domínio.

## Tecnologia

Sequelize + perfil tedioso.

## Construa serviços com SQL Server

1. Inicie o contêiner:

```bash
bun run docker:up:mssql
```

2. Definir ambiente:

```bash
JUMENTIX_DATABASE_DRIVER=MSSQL
JUMENTIX_DB_HOST=127.0.0.1
JUMENTIX_DB_PORT=1433
JUMENTIX_DB_NAME=jumentix
JUMENTIX_DB_USERNAME=sa
JUMENTIX_DB_PASSWORD=YourStrong!Passw0rd
```

3. Inicie o adaptador de serviço.

## Checklist júnior (“Eu consigo …”)

- [ ] Sei quando escolher este adapter
- [ ] Consigo iniciá-lo pelo script documentado
- [ ] Sei o próximo guia/pacote

## Próximo passo

Volte para [Começando](/docs/pt-BR/jumentix/concepts/getting-started) ou o guia correspondente.
