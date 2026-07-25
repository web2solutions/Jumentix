<!--
Arquivo gerado automaticamente a partir de: documentation/md/SPEC-KNOWLEDGE-SOURCE-MAP.md
Idioma alvo: Português (Brasil)
-->
# Spec Mapa de fonte de conhecimento

Este mapa define onde reside a verdade das especificações e como as fontes são priorizadas.

## Prioridade de origem

Quando ocorrem conflitos, a ordem de resolução é:

1. Especificações de contrato versionadas (`spec/1.0.0.yml`, `spec/asyncapi/*`)
2. Requisitos de governança (`.agents/requirements/*`, `.agents/NFR-REGISTRY.md`)
3. Governança do projeto (`documentation/md/JUMENTIX-PROJECT-GOVERNANCE.md`)
4. Portas executáveis CI/CD (`ci-cd/*`, husky hooks, política de cobertura)
5. Documentos técnicos de arquitetura (`documentation/md/*`)
6. Documentos de posicionamento de produto/comercial (`README.md`, conteúdo do site)

## Fontes autorizadas por domínio

## Intenção do produto e escopo de entrega

- Posicionamento raiz: `README.md`
- Visão geral do projeto: `documentation/md/PROJECT-OVERVIEW.md`
- Sistema de composição de produtos: `documentation/md/SPEC-JUMENTIX-COMPONENT-SYSTEM.md`
- Quadro do projeto: `https://github.com/users/web2solutions/projects/1`
- Lista de pendências de problemas: `https://github.com/web2solutions/aaa-typescript-boilerplate/issues`

## Arquitetura e Design

- `documentação/md/ARQUITETURA-E-ESTRUTURA.md`
- `documentation/md/HEXAGONAL-FEATURE-DRIVEN-MIGRATION.md`
- `.agents/requirements/015-architecture-nfr-ddd-eda-hexagonal.md`
- `.agents/requirements/016-layer-call-order-and-boundaries.md`
- `.agents/requirements/017-event-first-integration-and-circular-safety.md`

## Contratos e Interfaces

- REST/OpenAPI: `spec/1.0.0.yml`
- Tempo real/AsyncAPI: `spec/asyncapi/1.0.0.websocket.yml`, `spec/asyncapi/1.0.0.grpc.yml`
- Mapa de eventos/mensagens: `documentation/md/EVENTS-AND-MESSAGES-MAP.md`
- Contratos de erro: `documentation/md/ERROR-CONTRACTS-AND-RESPONSES.md`
- Requisito de objeto de porta: `.agents/requirements/036-openapi-port-objects-contracts.md`

## Tempo de execução e implantação

- Contratos de ambiente de tempo de execução: `documentation/md/RUNTIME-ENVIRONMENT-CONTRACTS.md`
- Configuração e tempo de execução da API: `documentation/md/SETUP-RUNTIME-AND-API.md`
- Requisito de orquestração PM2: `.agents/requirements/041-pm2-vm-runtime-orchestration.md`
- Seleção de adaptador orientado a ambiente: `.agents/requirements/042-env-driven-runtime-adapter-selection.md`

## Dados, domínio e persistência

- Documentação de entidades de domínio: `documentation/md/DOMAIN-DATA-ENTITIES.md`
- Documentos de domínio de usuários em `documentation/md/domains/users/*`
- Adaptadores de dados externos: `documentation/md/EXTERNAL-DATA-ADAPTER-FOUNDATIONS.md`
- Validação de fumaça do banco de dados: `documentation/md/DATABASE-DRIVERS-SMOKE-TESTS.md`

## Qualidade, segurança e conformidade

- CI e qualidade: `documentation/md/TESTING-CI-AND-QUALITY.md`
- Solução de problemas de CI: `documentation/md/CI-TROUBLESHOOTING.md`
- Runbook PCI: `documentation/md/SECURITY-RUNBOOK-PCI.md`
- Plano de remediação de PCI: `documentation/md/PCI-REMEDIATION-PLAN-AND-EVIDENCE.md`
- Contrato de especificação de segurança/conformidade: `documentation/md/SPEC-SECURITY-AND-COMPLIANCE-PRACTICES.md`
- Requisito de reforço de segurança: `.agents/requirements/044-pci-security-compliance-hardening.md`

## Governança e Processo

- Governança do projeto: `documentation/md/JUMENTIX-PROJECT-GOVERNANCE.md`
- Ponte de gerenciamento de projetos: `documentation/md/PROJECT-MANAGEMENT.md`
- Contrato da diretoria do projeto: `documentation/md/SPEC-PROJECT-BOARD-CONTRACT.md`
- Práticas de engenharia + política git: `documentation/md/SPEC-ENGINEERING-PRACTICES-AND-GIT-POLICY.md`
- Política de captura de NFR: `.agents/requirements/068-nfr-capture-and-registry-governance.md`
- Integridade de confirmação/push: `.agents/requirements/065-commit-push-integrity-and-real-ci-enforcement.md`

## Gatilhos de atualização de origem

Qualquer alteração no seguinte requer atualizações de especificações:

1. Alteração de objeto de domínio/entidade/modelo/valor
2. Alteração de endpoint/operação/evento/mensagem da API
3. Erro na alteração do esquema de contrato/resposta
4. Variável de tempo de execução/implantação, adaptador ou mudança de fluxo de inicialização
5. Mudança de comportamento de segurança/conformidade
6. Mudança nas regras de governança

## Destinos de sincronização necessários

Quando ocorrer algum gatilho, atualize pelo menos:

- Arquivo(s) de especificação correspondente(s) em `/spec`
- Documentos correspondentes em `documentation/md`
- Arquivo de requisitos relevantes em `.agents/requirements`
- Registro NFR e índice de agente quando o comportamento não funcional é afetado

## Recursos de consolidação baseados em especificações canônicas

Os seguintes documentos consolidam o conhecimento de fontes cruzadas e devem ser atualizados sempre que a compreensão global mudar:

1. `SPEC-CANONICAL-KNOWLEDGE-BASELINE.md`
2. `SPEC-FEATURES-WORKFLOWS-CATALOG.md`
3. `SPEC-REQUIREMENTS-TRACEABILITY-LEDGER.md`
4. `SPEC-DELIVERY-GATES-AND-EVIDENCE.md`
5. `SPEC-OPERATING-MODEL-BY-COMPONENT.md`
6. `SPEC-PROJECT-BOARD-CONTRACT.md`
7. `SPEC-ENGINEERING-PRACTICES-AND-GIT-POLICY.md`
8. `SPEC-SECURITY-AND-COMPLIANCE-PRACTICES.md`
9. `SPEC-JUMENTIX-COMPONENT-SYSTEM.md`
