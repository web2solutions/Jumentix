<!--
Arquivo gerado automaticamente a partir de: documentation/md/adapters/databases/FIREBASE.md
Idioma alvo: Português (Brasil)
-->
# Adaptador Firebase

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

Adapter FIREBASE para interfaces databases do Jumentix — monta use-cases sem vazar tipos de framework no domínio.

## Tecnologia

Perfil de administrador do Firebase.

## Crie serviços com Firebase

1. Inicie o contêiner do emulador local (se configurado):

```bash
bun run docker:up:firebase
```

2. Definir ambiente:

```bash
JUMENTIX_DATABASE_DRIVER=Firebase
JUMENTIX_FIREBASE_PROJECT_ID=jumentix-dev
JUMENTIX_FIREBASE_CREDENTIALS_JSON=./path/to/service-account.json
```

3. Inicie o adaptador de serviço.

## Checklist júnior (“Eu consigo …”)

- [ ] Sei quando escolher este adapter
- [ ] Consigo iniciá-lo pelo script documentado
- [ ] Sei o próximo guia/pacote

## Próximo passo

Volte para [Começando](/docs/pt-BR/jumentix/concepts/getting-started) ou o guia correspondente.
