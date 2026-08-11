<!--
Arquivo gerado automaticamente a partir de: documentation/md/adapters/databases/MONGODB.md
Idioma alvo: Português (Brasil)
-->
# Adaptador MongoDB

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

Adapter MONGODB para interfaces databases do Jumentix — monta use-cases sem vazar tipos de framework no domínio.

## Tecnologia

Perfil do mangusto.

## Construa serviços com MongoDB

1. Inicie o contêiner:

```bash
bun run docker:up:mongodb
```

2. Definir ambiente:

```bash
JUMENTIX_DATABASE_DRIVER=Mongo
JUMENTIX_DATABASE_CONNECTION_URL=mongodb://127.0.0.1:27027/jumentix
```

3. Inicie o adaptador de serviço.

## Checklist júnior (“Eu consigo …”)

- [ ] Sei quando escolher este adapter
- [ ] Consigo iniciá-lo pelo script documentado
- [ ] Sei o próximo guia/pacote

## Próximo passo

Volte para [Começando](/docs/pt-BR/jumentix/concepts/getting-started) ou o guia correspondente.
