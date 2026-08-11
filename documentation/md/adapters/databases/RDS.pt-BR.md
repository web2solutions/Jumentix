<!--
Arquivo gerado automaticamente a partir de: documentation/md/adapters/databases/RDS.md
Idioma alvo: Português (Brasil)
-->
# Adaptador RDS

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

Adapter RDS para interfaces databases do Jumentix — monta use-cases sem vazar tipos de framework no domínio.

## Tecnologia

Caminho de integração do Amazon RDS (perfil SQL na camada do adaptador externo).

## Crie serviços com RDS

1. Definir ambiente:

```bash
JUMENTIX_DATABASE_DRIVER=RDS
JUMENTIX_DATABASE_CONNECTION_URL=postgres://user:pass@rds-host:5432/jumentix
```

2. Inicie o adaptador de serviço.
3. Valide com comando smoke:

```bash
bun run smoke:db:rds
```

## Checklist júnior (“Eu consigo …”)

- [ ] Sei quando escolher este adapter
- [ ] Consigo iniciá-lo pelo script documentado
- [ ] Sei o próximo guia/pacote

## Próximo passo

Volte para [Começando](/docs/pt-BR/jumentix/concepts/getting-started) ou o guia correspondente.
