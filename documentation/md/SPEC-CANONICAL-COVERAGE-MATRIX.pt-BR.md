<!--
Arquivo gerado automaticamente a partir de: documentation/md/SPEC-CANONICAL-COVERAGE-MATRIX.md
Idioma alvo: Português (Brasil)
-->
# Matriz de cobertura canônica de especificações

Esta matriz garante que todas as áreas de conhecimento conhecidas da Jumentix sejam cobertas por recursos orientados ao desenvolvimento de especificações.

## Matriz de Cobertura

| Área de Conhecimento | Fontes Canônicas | Recursos baseados em especificações | Aplicação |
| --- | --- | --- | --- |
| Intenção do produto e proposta de valor | `README.md`, documentos/conteúdo do site | `SPEC-DEVELOPMENT-DRIVEN-INDEX.md`, `SPEC-KNOWLEDGE-SOURCE-MAP.md` | Escopo da emissão + critérios de aceitação |
| Inventário de base de conhecimento completo | todos os documentos, especificações, agentes, metadados do painel do projeto | `SPEC-CANONICAL-KNOWLEDGE-BASELINE.md`, `SPEC-KNOWLEDGE-SOURCE-MAP.md` | revisão de rastreabilidade no PR |
| Recursos e capacidades de domínio | `documentation/md/*`, arquivos README do componente | `SPEC-LIFECYCLE-AND-WORKFLOW.md`, `SPEC-TEMPLATES-AND-CHECKLISTS.md` | Evidências de relações públicas + testes |
| Catálogo de execução de recursos/fluxo de trabalho | documentos de componentes + runtime/docs + adaptadores | `SPEC-FEATURES-WORKFLOWS-CATALOG.md` | mapeamento do escopo às especificações no planejamento |
| Fluxos de trabalho e processo de execução | `JUMENTIX-PROJECT-GOVERNANCE.md`, `PROJECT-MANAGEMENT.md` | `SPEC-GOVERNANCE-AND-TRACEABILITY.md`, `SPEC-LIFECYCLE-AND-WORKFLOW.md` | Conclusão do projeto em campo + vinculação de relações públicas |
| Comportamento funcional do contrato | `spec/1.0.0.yml`, `spec/asyncapi/*`, documentos do contrato | `SPEC-KNOWLEDGE-SOURCE-MAP.md`, `SPEC-TEMPLATES-AND-CHECKLISTS.md` | Verificações de contratos (`oas:check-routes`, validações em tempo real) |
| Contratos de erro e integração | `ERRO-CONTRATOS-E-RESPONSES.md`, `EVENTOS-E-MENSAGENS-MAP.md` | `SPEC-KNOWLEDGE-SOURCE-MAP.md`, `SPEC-ARQUITETURA-CODING-STANDARDS.md` | Integração e testes unitários |
| Requisitos e NFRs | `.agents/requirements/project/*.md`, `.agents/requirements/software/*.md`, `.agents/NFR-REGISTRY.md` | `SPEC-GOVERNANCE-AND-TRACEABILITY.md`, `SPEC-KNOWLEDGE-SOURCE-MAP.md` | Regra de sincronização do registro NFR |
| Rastreabilidade em nível de requisito | `.agents/requirements/project/*.md`, `.agents/requirements/software/*.md`, Issues, Projects, milestones e Project Updates do Linear | `SPEC-REQUIREMENTS-TRACEABILITY-LEDGER.md`, `SPEC-GOVERNANCE-AND-TRACEABILITY.md` | IDs de requisitos referenciados em PR |
| Regras de governação do projeto | `JUMENTIX-PROJECT-GOVERNANCE.md` | `SPEC-GOVERNANCE-AND-TRACEABILITY.md` | Rastreabilidade obrigatória de questões/projetos/RP |
| Contrato de governança do Project | Campos do Linear, ciclos, rótulos, milestones e status | `SPEC-PROJECT-BOARD-CONTRACT.md` | metadados ausentes bloqueiam a conclusão |
| Padrões de codificação e disciplina de implementação | orientação de engenharia existente + políticas de lint/teste | `SPEC-ARQUITETURA-PADRÕES DE CODIFICAÇÃO.md` | Lint + verificações de arquitetura |
| Fluxo de trabalho Git e governança de commit | ganchos husky, commitlint, política de governança de projetos | `SPEC-ENGINEERING-PRACTICES-AND-GIT-POLICY.md` | commit hooks + portões de governança de CI |
| Princípios de arquitetura e design | `ARCHITECTURE-AND-STRUCTURE.md`, documentos de migração, NFRs de arquitetura | `SPEC-ARQUITETURA-CODING-STANDARDS.md`, `SPEC-KNOWLEDGE-SOURCE-MAP.md` | Verificações de limites + verificações de ciclo |
| Propriedade e sincronização de componentes | `apps/*`, `pacotes/*`, `.agents/*` | `SPEC-OPERATING-MODEL-BY-COMPONENT.md` | documentos + verificações de sincronização de requisitos |
| Clareza da composição do produto (bibliotecas/ferramentas/modelos/componentes) | estrutura do espaço de trabalho + documentos de pacote/aplicativo |`SPEC-JUMENTIX-COMPONENT-SYSTEM.md` | documentos de composição + sincronização de governança |
| Modelo de tempo de execução/implantação | documentos de tempo de execução, documentos PM2, contratos ambientais | `SPEC-KNOWLEDGE-SOURCE-MAP.md`, `SPEC-LIFECYCLE-AND-WORKFLOW.md` | Verificações de compilação/fumo/tempo de execução |
| Regras de segurança e conformidade | Documentos PCI, requisitos de segurança, fumaça de segurança | `SPEC-ARQUITETURA-CODING-STANDARDS.md`, `SPEC-GOVERNANCE-AND-TRACEABILITY.md` | Segurança fumaça + portões CI |
| Práticas de engenharia de segurança/conformidade | runbook de segurança, política de remediação, portas de segurança CI | `SPEC-SECURITY-AND-COMPLIANCE-PRACTICES.md` | verificações de segurança + provas de relações públicas auditáveis ​​|
| Política de qualidade e cobertura | `TESTING-CI-AND-QUALITY.md`, scripts de CI | `SPEC-LIFECYCLE-AND-WORKFLOW.md`, `SPEC-GOVERNANCE-AND-TRACEABILITY.md` | Limiares de cobertura + pré-empurrão rigoroso |
| Embalagem de evidências de portão | Descrição PR, resultados de CI, resultados de segurança | `SPEC-DELIVERY-GATES-AND-EVIDENCE.md` | mesclagem bloqueada quando faltam evidências |

## Famílias de origem incluídas

O modelo Spec Development Driven inclui explicitamente as seguintes famílias de informações:

1. Documentação em nível Monorepo (`documentation/`, `README.md`)
2. Documentação técnica do componente (`apps/*/documentation`, `packages/*/README.md`)
3. Especificações de API versionadas (`/spec`)
4. Scripts e verificações de governança (`ci-cd/*`, ganchos, configurações de qualidade)
5. Registro de requisitos e NFR (`.agents/requirements`, `.agents/NFR-REGISTRY.md`)
6. Governança do projeto e processos de conselho (`JUMENTIX-PROJECT-GOVERNANCE.md`, Linear Project Jumentix)

## Regra de integridade

Qualquer nova fonte de verdade introduzida no projeto deve ser:

1. Adicionado a `SPEC-KNOWLEDGE-SOURCE-MAP.md`
2. Mapeado nesta matriz
3. Vinculado a um mecanismo de validação/aplicação
