<!--
Arquivo gerado automaticamente a partir de: documentation/md/SPEC-CANONICAL-KNOWLEDGE-BASELINE.md
Idioma alvo: Português (Brasil)
-->
# Linha de base de conhecimento canônico de especificações

Este documento define a linha de base de conhecimento completa que o Spec Development Driven deve capturar para o Jumentix.

Cada decisão de implementação, lançamento e governança deve ser representável por meio de artefatos de especificações que mapeiem essa linha de base.

## Meta básica

Jumentix nunca deve depender da memória implícita da equipe para comportamento crítico.  
Todas as intenções conhecidas devem ser explícitas, versionadas e rastreáveis.

## Famílias de Conhecimento Canônico

1. Intenção do produto e proposta de valor
   - Fontes:
     - `README.md`
     - `apps/jumentix-website/*`
2. Princípios de arquitetura e restrições de design
   - Fontes:
     - `documentação/md/ARQUITETURA-E-ESTRUTURA.md`
     - `documentation/md/HEXAGONAL-FEATURE-DRIVEN-MIGRATION.md`
     - `.agents/requirements/software/015-architecture-nfr-ddd-eda-hexagonal.md`
     - `.agents/requirements/software/016-layer-call-order-and-boundaries.md`
     - `.agents/requirements/software/017-event-first-integration-and-circular-safety.md`
3. Contratos de domínio e modelo de dados
   - Fontes:
     - `documentação/md/DOMAIN-DATA-ENTITIES.md`
     - `documentação/md/domínios/usuários/*`
     - `.agents/requirements/project/019-domain-data-entity-documentation-standard.md`
     - `.agents/requirements/software/026-openapi31-data-entity-model-compliance.md`
     - `.agents/requirements/software/032-entity-timestamps-domain-object-methods-and-oas-sync.md`
4. Contratos de interface e comunicação
   - Fontes:
     - `spec/1.0.0.yml`
     - `spec/asyncapi/1.0.0.websocket.yml`
     - `spec/asyncapi/1.0.0.grpc.yml`
     - `documentação/md/EVENTS-AND-MESSAGES-MAP.md`
     - `documentação/md/ERROR-CONTRACTS-AND-RESPONSES.md`
5. Contratos de tempo de execução, infraestrutura, implantação e operações
   - Fontes:
     - `documentação/md/RUNTIME-ENVIRONMENT-CONTRACTS.md`
     - `documentação/md/SETUP-RUNTIME-AND-API.md`
     - `documentação/md/JUMENTIX-DEPLOY-TARGET-AND-PACKAGING-MATRIX.md`
     - `pm2/*`
6. Regras de qualidade, segurança e conformidade
   - Fontes:
     - `documentação/md/TESTING-CI-AND-QUALITY.md`
     - `documentação/md/SECURITY-RUNBOOK-PCI.md`
     - `documentation/md/PCI-REMEDIATION-PLAN-AND-EVIDENCE.md`
     - `ci-cd/*`
7. Modelo de governança e execução do projeto
   - Fontes:
     - `documentação/md/JUMENTIX-PROJECT-GOVERNANCE.md`
     - `documentação/md/PROJECT-MANAGEMENT.md`
     - `.agentes/requisitos/*`
     - `.agentes/NFR-REGISTRY.md`
     - Projeto Linear: `https://linear.app/jumentix`

## Regra de cobertura de especificações

Para cada família de conhecimento acima, Jumentix deve manter:

1. Especificar artefato(s) que definem comportamento ou política.
2. Mecanismo(s) de aplicação em CI, testes, verificações ou política de fluxo de trabalho.
3. Links de rastreabilidade para problemas, itens de projeto, PR e arquivos alterados.

## Política de estado sem estado desconhecido

Uma entrega está incompleta quando qualquer comportamento alterado não está representado em pelo menos um dos seguintes:

1. Documentos de contrato OpenAPI/AsyncAPI/mensagem/erro.
2. Documentos de domínio/entidade/modelo/objeto de valor.
3. Contratos de tempo de execução/implantação/ambiente.
4. Registro de governança de requisitos/NFR.
5. Evidências de validação (testes/verificações/cobertura/portas de segurança).

## Destinos de sincronização (obrigatório)

Quando o conhecimento mudar, atualize no mesmo ciclo:

1. Recursos de contrato `spec/*` (quando as interfaces/mensagens mudam).
2. Recursos técnicos `documentation/md/*`.
3. `.agents/requirements/*` quando restrições ou governança são afetadas.
4. `.agents/NFR-REGISTRY.md` quando o comportamento não funcional muda.
5. Metadados da Issue/Project e Project Updates no Linear, com links de evidências do PR no
   GitHub.
