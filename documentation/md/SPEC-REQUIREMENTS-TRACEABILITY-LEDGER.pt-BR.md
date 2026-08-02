<!--
Arquivo gerado automaticamente a partir de: documentation/md/SPEC-REQUIREMENTS-TRACEABILITY-LEDGER.md
Idioma alvo: Português (Brasil)
-->
# Especificações de rastreabilidade de requisitos

<!-- requirements-inventory: files=124 unique=121 mapped=121 duplicates=055,060,079 -->

Este livro-razão mapeia IDs de requisitos para especificações de recursos e expectativas de evidências de validação.

É a ponte canônica entre `.agents/requirements` e fluxos de trabalho de implementação.

## Como usar

Para qualquer alteração, identifique os IDs dos requisitos afetados e garanta:

1. Os arquivos de especificação/doc correspondentes são atualizados.
2. Testes/verificações correspondentes são executados.
3. PR faz referência aos IDs e evidências dos requisitos.

## Grupos de Requisitos

## A. Integridade de construção, tempo de execução e dependência

- `001`, `002`, `012`, `013`, `041`, `042`, `043`, `052`, `096`
- Recursos de especificações:
  - `documentação/md/RUNTIME-ENVIRONMENT-CONTRACTS.md`
  - `documentação/md/SETUP-RUNTIME-AND-API.md`
  - `pm2/*`
  - documentos do adaptador de tempo de execução em `documentation/md/adapters/http/*`
- Evidência:
  - testes de inicialização em tempo de execução
  - Verificações de inicialização/construção de CI

## B. Serviço principal e correção de domínio

- `003`, `004`, `005`, `006`, `007`, `022`, `029`, `031`, `032`, `045`, `061`
- Recursos de especificações:
  - `spec/1.0.0.yml`
  - `documentação/md/DOMAIN-DATA-ENTITIES.md`
  - `documentação/md/domínios/usuários/*`
  - `documentação/md/ERROR-CONTRACTS-AND-RESPONSES.md`
- Evidência:
  - testes unitários para serviços/modelos/controladores
  - testes de integração para comportamento de endpoint

## C. Conformidade de contrato e interface

- `008`, `010`, `021`, `026`, `027`, `028`, `036`, `047`
- Recursos de especificações:
  - `spec/1.0.0.yml`
  - `spec/asyncapi/1.0.0.websocket.yml`
  - `spec/asyncapi/1.0.0.grpc.yml`
  - `documentação/md/EVENTS-AND-MESSAGES-MAP.md`
  - `documentação/md/contratos/*`
- Evidência:
  - verificações de resolução de rota/canal
  - integração em tempo real/testes de fumaça

## D. Adaptador de dados e interoperabilidade de persistência

- `030`, `039`, `040`, `046`, `050`, `051`
- Recursos de especificações:
  - `documentação/md/EXTERNAL-DATA-ADAPTER-FOUNDATIONS.md`
  - `documentação/md/adaptadores/bancos de dados/*`
  - `documentação/md/DATABASE-DRIVERS-SMOKE-TESTS.md`
  - `pacotes/contratos de persistência/*`
- Evidência:
  - testes de fumaça de banco de dados por motorista
  - testes de inicialização do adaptador

## E. Governança de Arquitetura e Design

- `015`, `016`, `017`, `034`, `048`, `049`, `053`, `058`, `059`, `060` (ambas as entradas), `062`
- Recursos de especificações:
  - `documentação/md/ARQUITETURA-E-ESTRUTURA.md`
  - `documentation/md/HEXAGONAL-FEATURE-DRIVEN-MIGRATION.md`
  - `documentação/md/JUMENTIX-MONOREPO-EXECUTION-PLAN.md`
  - `documentação/md/JUMENTIX-MIGRATION-INVENTORY-AND-ROLLBACK.md`
- Evidência:
  - verificações de limites
  - verificações do ciclo de importação
  - verificações do espaço de trabalho

## F. Portões de qualidade, segurança e conformidade

- `011`, `014`, `020`, `044`, `063`, `065`, `074`, `087`, `088`, `104`, `105`, `106`, `107`, `108`, `109`, `110`, `111`, `112`, `113`, `115`, `118`
- Recursos de especificações:
  - `documentação/md/TESTING-CI-AND-QUALITY.md`
  - `documentation/md/HEXAGONAL-TEST-PYRAMID.pt-BR.md`
  - `documentação/md/SECURITY-RUNBOOK-PCI.md`
  - `documentation/md/PCI-REMEDIATION-PLAN-AND-EVIDENCE.md`
  - `documentation/md/CANONICAL-INTEGRATIONS-AND-PROVIDER-REBINDING.pt-BR.md`
  - scripts de cobertura/verificação em `ci-cd/*`
- Evidência:
  - Portão CI verde
  - prova de limite de cobertura
  - resultados da verificação de segurança/conformidade
  - `bun run integrations:check` e evidência terminal dos provedores

## G. Documentação, processo de governança e operações multiagente

- `009`, `018`, `019`, `023`, `024`, `025`, `033`, `035`, `056`, `057`, `064`, `066`, `067`, `068`, `071`, `072`, `073`, `075`, `076`, `077`, `078`, `079`, `080`, `081`, `082`, `083`, `084`, `085`, `086`, `087`, `088`, `089`, `090`, `094`, `095`, `097`, `098`, `099`, `100`, `101`, `102`, `103`, `104`, `105`, `106`, `107`, `108`, `109`, `110`, `111`, `112`, `113`, `114`, `116`, `117`, `119`, `120`, `121`
- Recursos de especificações:
  - `documentação/README.md`
  - `documentação/md/JUMENTIX-PROJECT-GOVERNANCE.md`
  - `documentação/md/PROJECT-MANAGEMENT.md`
  - `documentation/md/CANONICAL-REPOSITORY-MIGRATION.pt-BR.md`
  - `INTEGRATION-MIGRATION-REQUIREMENT.pt-BR.md`
  - `.agentes/README.md`
  - `.agentes/NFR-REGISTRY.md`
  - `.agents/AGENT-REGISTRY.md`
  - `AGENTS.md`
  - `CLAUDE.md`
  - `GROK.md`
- Evidência:
  - links de índice de documentos atualizados
  - registro de requisitos sincronizado
  - `bun run requirements:check` aprovado
  - paridade de instruções de agentes (Codex, Claude Code, Grok)
  - registros de cadastro de agentes e atribuição por disponibilidade
  - registros de associação ao milestone, parentagem do épico focado, agrupamento por natureza e
    delegação no nível do épico
  - registros de checagem prévia de `main` e `dev` antes da execução
  - rastreabilidade do projeto/PR presente
  - PRs de tarefa têm `dev` como destino, e somente promoções de release originadas em `dev` têm `main` como destino
  - Project de épico concluído no Linear vinculado à sua Issue dedicada de documentação concluída e às evidências
  - Project Updates específicos da tarefa do início à transferência final, com evidências de
    agente, entrega, gates exatos, bloqueios/riscos e próxima ação

## H. Produtização e expansão da plataforma

- `037`, `038`, `054`, `055` (ambas as entradas), `069`, `070`, `091`, `092`, `093`
- Recursos de especificações:
  - `pacotes/cli-init/*`
  - `apps/gerenciamento de serviço/documentação/*`
  - `documentação/md/SDK-COMPATIBILITY-BRIDGE.md`
  - documentos do site e fluxos de implantação
- Evidência:
  - testes de pacote/aplicativo
  - validação de script de implantação
  - documentos + sincronização de governança

## Vinculação de Governança

Este livro-razão é obrigatório no planejamento de RP para mudanças de médio/alto impacto.  
Se os IDs de requisitos afetados não forem mapeados antes da implementação, a alteração não estará em conformidade com Spec Development Driven.

## Atestado de cobertura (linha de base atual)

A partir de `2026-08-01`, este livro-razão cobre todos os IDs de requisitos exclusivos atualmente registrados em `.agents/requirements`:

1. Arquivos de requisitos no registro: `124`
2. IDs exclusivos no registro de requisitos: `121`
3. IDs exclusivos mapeados neste livro-razão: `121`
4. IDs duplicados com arquivos vinculantes independentes: `055`, `060`, `079`
5. IDs ausentes: `nenhum`

### `105` Pirâmide de testes hexagonal / gates por camada
- Specs: `documentation/md/HEXAGONAL-TEST-PYRAMID.pt-BR.md`, `.agents/requirements/105-hexagonal-test-pyramid-layer-aware-gates.md`
- Evidence: `test-map.json`, `ci-cd/check-test-map.js`, `ci-cd/lib/layer-resolver.js`, `ci-cd/run-task-change-tests.js`, `ci-cd/run-unit-tests.js`

### `114`–`121` Pacote operacional de agentes (JUM-595 + adições do owner em 2026-08-02)
- Specs: `documentation/md/AGENT-OPERATING-REQUIREMENTS-114-121.pt-BR.md` (+ EN)
- Requisitos: `.agents/requirements/114-*.md` … `121-*.md`
- Evidência: `bun run requirements:check`; paridade em `AGENTS.md` / `CLAUDE.md` / `GROK.md`; scripts Docker de smoke/integration para `118`; orquestração API-first / `gh` para `119`; visibilidade de assignment de agente no Linear para `120`; evidência de coordenação entre agentes para `121`
