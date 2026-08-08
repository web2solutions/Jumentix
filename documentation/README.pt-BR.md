# Hub de Documentação Jumentix

> Repositório privado canônico: `XpertMinds/Jumentix`. Consulte
> [Migração dos repositórios canônicos](./md/CANONICAL-REPOSITORY-MIGRATION.pt-BR.md) ·
> [Requisito de migração de integrações](../INTEGRATION-MIGRATION-REQUIREMENT.pt-BR.md) ·
> [Integrações canônicas e revinculação de provedores](./md/CANONICAL-INTEGRATIONS-AND-PROVIDER-REBINDING.pt-BR.md).

Esta documentação está organizada por público e sincronizada com a baseline `dev` do repositório.
Uma capacidade documentada é atual somente quando sua implementação, manifesto ou contrato
referenciado existe em `dev`; trabalho futuro deve ser identificado explicitamente como planejado.

## Mapa de Componentes do Repositório

- **Aplicações**
  - [Backend Template](../apps/backend-template/README.pt-BR.md): composição de runtimes REST,
    WebSocket, gRPC, CLI, persistência, mensageria, serverless e PM2.
  - [Service Management](../apps/service-management/README.pt-BR.md): servidor/interface de gestão e
    fluxos de definição de serviços.
  - [Website Jumentix](../apps/jumentix-website/README.pt-BR.md): site comercial e documental
    bilíngue, sincronização de conteúdo, Storybook e entrega na Vercel.
- **Pacotes reutilizáveis**
  - [Catálogo completo de pacotes](../packages/README.pt-BR.md), incluindo runtime, persistência,
    mensageria, SDK, configuração privada e workspaces reservados de contratos.
- **Compatibilidade e contratos**
  - [Camada legada de compatibilidade dos SDKs](../sdk-clients/README.pt-BR.md).
  - [Fontes OpenAPI e AsyncAPI](../spec/).
- **Automação e entrega**
  - [Scripts de tooling](../tooling/README.pt-BR.md).
  - [Documentação para criadores](./creators/README.pt-BR.md) sobre CI, governança, release e
    manutenção.

## Documentação de Consumidores (pública)

Para times e product owners que usam o Jumentix para construir software:

- [Índice de Documentação de Consumidores](./consumers/README.pt-BR.md)

## Documentação de Criadores (mantenedores/interna)

Para engenheiros que mantêm e evoluem o Jumentix:

- [Índice de Documentação de Criadores](./creators/README.pt-BR.md)
- [Requisitos Operacionais de Agente 114–121](./md/AGENT-OPERATING-REQUIREMENTS-114-121.pt-BR.md)
  ([EN](./md/AGENT-OPERATING-REQUIREMENTS-114-121.md))
- [Arquitetura de módulos do Service Management e contrato da porta IDesignerStore](./md/SERVICE-MANAGEMENT-MODULE-ARCHITECTURE.pt-BR.md)
  ([EN](./md/SERVICE-MANAGEMENT-MODULE-ARCHITECTURE.md))
- [Garantias de paridade de contratos do Service Management](./md/SERVICE-MANAGEMENT-CONTRACT-PARITY.pt-BR.md)
  ([EN](./md/SERVICE-MANAGEMENT-CONTRACT-PARITY.md))
- [Console de operações do Service Management](./md/SERVICE-MANAGEMENT-OPERATIONS-CONSOLE.pt-BR.md)
  ([EN](./md/SERVICE-MANAGEMENT-OPERATIONS-CONSOLE.md))
- [Design system e shell PWA do Service Management](./md/SERVICE-MANAGEMENT-DESIGN-SYSTEM-PWA.pt-BR.md)
  ([EN](./md/SERVICE-MANAGEMENT-DESIGN-SYSTEM-PWA.md))

## Hubs Técnicos de Componentes

- [Documentação do Backend Template](../apps/backend-template/documentation/README.pt-BR.md)
- [Documentação do Service Management](../apps/service-management/documentation/README.pt-BR.md)
- [Jumentix Website](../apps/jumentix-website/README.pt-BR.md)
- [Documentação Técnica do Jumentix Website](../apps/jumentix-website/documentation/README.pt-BR.md)
- [Pacotes do Workspace](../packages/README.pt-BR.md)
- [Tooling](../tooling/README.pt-BR.md)

## Referências de Contratos e Runtime

- [Especificação OpenAPI](../spec/1.0.0.yml)
- [Mapa de Eventos e Mensagens](./md/EVENTS-AND-MESSAGES-MAP.pt-BR.md)
- [Contratos de Erro e Respostas](./md/ERROR-CONTRACTS-AND-RESPONSES.pt-BR.md)
- [Contratos de Ambiente de Runtime](./md/RUNTIME-ENVIRONMENT-CONTRACTS.pt-BR.md)
- [AsyncAPI WebSocket](../spec/asyncapi/1.0.0.websocket.yml)
- [AsyncAPI gRPC](../spec/asyncapi/1.0.0.grpc.yml)

## Integridade da Documentação

Execute estas verificações na raiz após mudanças documentais:

```bash
bun run docs:consumers:package-scripts
bun run website:test:prepublish
bun run ci:gate:task
```

O gerador de scripts é autoritativo para a referência de comandos do consumidor. O gate de
pré-publicação do website sincroniza as fontes Markdown e valida rotas/conteúdo. O gate da tarefa
seleciona as verificações adequadas do repositório para uma branch somente de documentação.
