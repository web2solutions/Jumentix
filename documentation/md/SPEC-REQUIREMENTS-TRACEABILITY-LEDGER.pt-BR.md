<!--
Arquivo gerado automaticamente a partir de: documentation/md/SPEC-REQUIREMENTS-TRACEABILITY-LEDGER.md
Idioma alvo: Português (Brasil)
-->
# Especificações de rastreabilidade de requisitos

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

- `011`, `014`, `020`, `044`, `063`, `065`, `074`
- Recursos de especificações:
  - `documentação/md/TESTING-CI-AND-QUALITY.md`
  - `documentação/md/SECURITY-RUNBOOK-PCI.md`
  - `documentation/md/PCI-REMEDIATION-PLAN-AND-EVIDENCE.md`
  - scripts de cobertura/verificação em `ci-cd/*`
- Evidência:
  - Portão CI verde
  - prova de limite de cobertura
  - resultados da verificação de segurança/conformidade

## G. Documentação, processo de governança e operações multiagente

- `009`, `018`, `019`, `023`, `024`, `025`, `033`, `035`, `056`, `057`, `064`, `066`, `067`, `068`, `071`, `072`, `073`, `075`, `076`, `077`, `078`, `079`, `080`, `081`, `082`, `083`, `084`, `085`, `086`, `087`, `088`, `089`, `090`, `094`, `097`
- Recursos de especificações:
  - `documentação/README.md`
  - `documentação/md/JUMENTIX-PROJECT-GOVERNANCE.md`
  - `documentação/md/PROJECT-MANAGEMENT.md`
  - `.agentes/README.md`
  - `.agentes/NFR-REGISTRY.md`
  - `.agents/AGENT-REGISTRY.md`
  - `AGENTS.md`
  - `CLAUDE.md`
  - `GROK.md`
- Evidência:
  - links de índice de documentos atualizados
  - registro de requisitos sincronizado
  - paridade de instruções de agentes (Codex, Claude Code, Grok)
  - registros de cadastro de agentes e atribuição por disponibilidade
  - registros de associação ao milestone, parentagem do épico focado, agrupamento por natureza e
    delegação no nível do épico
  - registros de checagem prévia de `main` e `dev` antes da execução
  - rastreabilidade do projeto/PR presente
  - PRs de tarefa têm `dev` como destino, e somente promoções de release originadas em `dev` têm `main` como destino
  - Project de épico concluído no Linear vinculado à sua Issue dedicada de documentação concluída e às evidências
  - status, prioridade, datas, rótulos, milestone, responsável e histórico de Project Updates da
    tarefa/Project no Linear

## H. Produtização e expansão da plataforma

- `037`, `038`, `054`, `055` (ambas as entradas), `069`, `070`
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

A partir de `2026-07-28`, este livro-razão cobre todos os IDs de requisitos exclusivos atualmente registrados em `.agents/requirements`:

1. IDs exclusivos no registro de requisitos: `96`
2. IDs exclusivos mapeados neste livro-razão: `96`
3. IDs ausentes: `nenhum`
