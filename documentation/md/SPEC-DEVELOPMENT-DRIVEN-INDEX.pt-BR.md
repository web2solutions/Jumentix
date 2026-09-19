<!--
Arquivo gerado automaticamente a partir de: documentation/md/SPEC-DEVELOPMENT-DRIVEN-INDEX.md
Idioma alvo: Português (Brasil)
-->
# Orientado para o desenvolvimento de especificações - Índice

A Jumentix agora trata as especificações como o principal ativo de engenharia.  
A implementação ocorre a jusante da qualidade da especificação, rastreabilidade e governança.

Este conjunto de documentação define como a intenção do produto, as restrições de arquitetura, os contratos, os portões de qualidade e a governança de entrega são transformados em trabalho executável.

## Objetivo

- Tome todas as decisões de entrega com foco nas especificações.
- Consolidar todas as restrições conhecidas do projeto em recursos de especificação explícita.
- Certifique-se de que cada alteração de código seja rastreável a um artefato de especificação governado.

## Documentos principais orientados ao desenvolvimento de especificações

1. [Mapa de fonte de conhecimento de especificações](./SPEC-KNOWLEDGE-SOURCE-MAP.md)
2. [Ciclo de vida e fluxo de trabalho de especificações](./SPEC-LIFECYCLE-AND-WORKFLOW.md)
3. [Arquitetura de especificações e padrões de codificação](./SPEC-ARCHITECTURE-CODING-STANDARDS.md)
4. [Governança e rastreabilidade de especificações](./SPEC-GOVERNANCE-AND-TRACEABILITY.md)
5. [Modelos de especificações e listas de verificação](./SPEC-TEMPLATES-AND-CHECKLISTS.md)
6. [Matriz de cobertura canônica específica](./SPEC-CANONICAL-COVERAGE-MATRIX.md)
7. [Linha de base de conhecimento canônico específico](./SPEC-CANONICAL-KNOWLEDGE-BASELINE.md)
8. [Catálogo de recursos e fluxos de trabalho específicos](./SPEC-FEATURES-WORKFLOWS-CATALOG.md)
9. [Lista de rastreabilidade de requisitos de especificações](./SPEC-REQUIREMENTS-TRACEABILITY-LEDGER.md)
10. [Portões e evidências de entrega de especificações](./SPEC-DELIVERY-GATES-AND-EVIDENCE.md)
11. [Especificação do modelo operacional por componente](./SPEC-OPERATING-MODEL-BY-COMPONENT.md)
12. [Contrato do Conselho do Projeto de Especificações](./SPEC-PROJECT-BOARD-CONTRACT.md)
13. [Status de cobertura dos requisitos de especificações](./SPEC-REQUIREMENTS-COVERAGE-STATUS.md)
14. [Práticas de engenharia de especificações e política Git](./SPEC-ENGINEERING-PRACTICES-AND-GIT-POLICY.md)
15. [Práticas de segurança e conformidade de especificações](./SPEC-SECURITY-AND-COMPLIANCE-PRACTICES.md)
16. [Sistema de componentes Spec Jumentix](./SPEC-JUMENTIX-COMPONENT-SYSTEM.md)
17. [Estratégia gratuita de CI para repositório público](./PRIVATE-FREE-CI-STRATEGY.pt-BR.md)

## Princípio Obrigatório

Nenhum recurso, correção de bug, refatoração, adaptador, contrato ou alteração de tempo de execução é considerado completo, a menos que:

1. A mudança é representada em artefatos de especificações.
2. Os artefatos de especificação estão vinculados aos registros de governança (Issue do Linear +
   Project focado + Project Update + PR no GitHub).
3. Verificações de qualidade, cobertura e arquitetura comprovam a conformidade com as especificações.

## Política de cobertura total de conhecimento

O desenvolvimento de especificações orientado no Jumentix cobre todas as fontes de informação conhecidas:

1. Intenção e posicionamento do produto
2. Recursos e fluxos de trabalho
3. Princípios de arquitetura e restrições de design
4. Contratos (HTTP, tempo real, evento, erro, objetos de porta)
5. Tempo de execução e comportamento de implantação
6. Políticas de segurança, qualidade e conformidade
7. Governança do projeto e rastreabilidade da entrega

Esta política é aplicada através de:

1. mapeamento de origem canônica
2. requisitos e livros-razão NFR
3. CI/cobertura/portões de segurança executáveis
4. Rastreabilidade do gerenciamento de projetos (Problema -> Projeto -> RP -> Evidência)

## Fontes de ligação

A autoridade dos repositórios segue
`documentation/md/CANONICAL-REPOSITORY-MIGRATION.pt-BR.md`: o repositório
público `web2solutions/Jumentix` é canônico para este conjunto de
especificações. A coordenação de agentes é canônica no Firestore Database,
conforme o Requisito `089`. A evidência histórica de transição está consolidada
em `documentation/md/HISTORICAL-TRANSITIONS.pt-BR.md`.

O Requisito `104` também vincula a revinculação completa dos provedores e
evidência terminal para integrações de CI, cobertura, segurança, deploy,
dependências, segredos, ambientes e webhooks. O inventário executável bilíngue
fica em
[`CANONICAL-INTEGRATIONS-AND-PROVIDER-REBINDING.pt-BR.md`](./CANONICAL-INTEGRATIONS-AND-PROVIDER-REBINDING.pt-BR.md).

A execução orientada por especificações depende e reutiliza estas fontes existentes:

- Contratos OpenAPI e AsyncAPI (`/spec`)
- Documentos de tempo de execução e arquitetura (`documentation/md`)
- Registro de requisitos de agentes (`.agents/requirements`)
- Registro NFR (`.agents/NFR-REGISTRY.md`)
- Instruções oficiais de agentes de IA (`AGENTS.md`, `CLAUDE.md`, `GROK.md`)
- Registro de colaboração de agentes (`.agents/AGENT-REGISTRY.md`)
- Regras de governança do projeto (`documentation/md/JUMENTIX-PROJECT-GOVERNANCE.md`)
- Placa Linear Project Jumentix (`https://linear.app/jumentix`)
