<!--
Arquivo gerado automaticamente a partir de: documentation/md/adapters/databases/MYSQL.md
Idioma alvo: Português (Brasil)
-->
# Adaptador MySQL

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

Adapter MYSQL para interfaces databases do Jumentix — monta use-cases sem vazar tipos de framework no domínio.

## Tecnologia

Sequelize + perfil mysql2.

## Crie serviços com MySQL

1. Inicie o contêiner:

```bash
bun run docker:up:mysql
```

2. Definir ambiente:

```bash
JUMENTIX_DATABASE_DRIVER=MySQL
JUMENTIX_DB_HOST=127.0.0.1
JUMENTIX_DB_PORT=3306
JUMENTIX_DB_NAME=jumentix
JUMENTIX_DB_USERNAME=root
JUMENTIX_DB_PASSWORD=root
```

3. Inicie seu adaptador API.

## Checklist júnior (“Eu consigo …”)

- [ ] Sei quando escolher este adapter
- [ ] Consigo iniciá-lo pelo script documentado
- [ ] Sei o próximo guia/pacote

## Próximo passo

Volte para [Começando](/docs/pt-BR/jumentix/concepts/getting-started) ou o guia correspondente.
