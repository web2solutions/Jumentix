# Spec Canonical Coverage Matrix

This matrix ensures that all known Jumentix knowledge areas are covered by Spec Development Driven resources.

## Coverage Matrix

| Knowledge Area | Canonical Sources | Spec-Driven Resources | Enforcement |
| --- | --- | --- | --- |
| Product intention and value proposition | `README.md`, website docs/content | `SPEC-DEVELOPMENT-DRIVEN-INDEX.md`, `SPEC-KNOWLEDGE-SOURCE-MAP.md` | Issue scope + acceptance criteria |
| Full knowledge baseline inventory | all docs, specs, agents, project board metadata | `SPEC-CANONICAL-KNOWLEDGE-BASELINE.md`, `SPEC-KNOWLEDGE-SOURCE-MAP.md` | traceability review in PR |
| Features and domain capabilities | `documentation/md/*`, component README files | `SPEC-LIFECYCLE-AND-WORKFLOW.md`, `SPEC-TEMPLATES-AND-CHECKLISTS.md` | PR evidence + tests |
| Feature/workflow execution catalog | component docs + runtime/docs + adapters | `SPEC-FEATURES-WORKFLOWS-CATALOG.md` | scope-to-spec mapping in planning |
| Workflows and execution process | `JUMENTIX-PROJECT-GOVERNANCE.md`, `PROJECT-MANAGEMENT.md` | `SPEC-GOVERNANCE-AND-TRACEABILITY.md`, `SPEC-LIFECYCLE-AND-WORKFLOW.md` | Project field completion + PR linkage |
| Functional contract behavior | `spec/1.0.0.yml`, `spec/asyncapi/*`, contract docs | `SPEC-KNOWLEDGE-SOURCE-MAP.md`, `SPEC-TEMPLATES-AND-CHECKLISTS.md` | Contract checks (`oas:check-routes`, realtime validations) |
| Error and integration contracts | `ERROR-CONTRACTS-AND-RESPONSES.md`, `EVENTS-AND-MESSAGES-MAP.md` | `SPEC-KNOWLEDGE-SOURCE-MAP.md`, `SPEC-ARCHITECTURE-CODING-STANDARDS.md` | Integration and unit tests |
| Requirements and NFRs | `.agents/requirements/project/*.md`, `.agents/requirements/software/*.md`, `.agents/NFR-REGISTRY.md` | `SPEC-GOVERNANCE-AND-TRACEABILITY.md`, `SPEC-KNOWLEDGE-SOURCE-MAP.md` | NFR registry sync rule |
| Requirement-level traceability | `.agents/requirements/project/*.md`, `.agents/requirements/software/*.md`, Linear Issues/Projects/milestones/Project Updates | `SPEC-REQUIREMENTS-TRACEABILITY-LEDGER.md`, `SPEC-GOVERNANCE-AND-TRACEABILITY.md` | requirement IDs referenced in PR |
| Project governance rules | `JUMENTIX-PROJECT-GOVERNANCE.md` | `SPEC-GOVERNANCE-AND-TRACEABILITY.md` | Mandatory issue/project/PR traceability |
| Board governance contract | Linear Project fields, iterations, labels, lifecycle status | `SPEC-PROJECT-BOARD-CONTRACT.md` | missing board metadata blocks closure |
| Coding standards and implementation discipline | existing engineering guidance + lint/test policies | `SPEC-ARCHITECTURE-CODING-STANDARDS.md` | Lint + architecture checks |
| Git workflow and commit governance | husky hooks, commitlint, project governance policy | `SPEC-ENGINEERING-PRACTICES-AND-GIT-POLICY.md` | commit hooks + CI governance gates |
| Architecture principles and design | `ARCHITECTURE-AND-STRUCTURE.md`, migration docs, architecture NFRs | `SPEC-ARCHITECTURE-CODING-STANDARDS.md`, `SPEC-KNOWLEDGE-SOURCE-MAP.md` | Boundary checks + cycle checks |
| Component ownership and sync | `apps/*`, `packages/*`, `.agents/*` | `SPEC-OPERATING-MODEL-BY-COMPONENT.md` | docs + requirement sync checks |
| Product composition clarity (libraries/tools/templates/components) | workspace structure + package/app docs | `SPEC-JUMENTIX-COMPONENT-SYSTEM.md` | composition docs + governance sync |
| Runtime/deployment model | runtime docs, PM2 docs, env contracts | `SPEC-KNOWLEDGE-SOURCE-MAP.md`, `SPEC-LIFECYCLE-AND-WORKFLOW.md` | Build/smoke/runtime checks |
| Security and compliance rules | PCI docs, security requirements, security smoke | `SPEC-ARCHITECTURE-CODING-STANDARDS.md`, `SPEC-GOVERNANCE-AND-TRACEABILITY.md` | Security smoke + CI gates |
| Security/compliance engineering practices | security runbook, remediation policy, CI security gates | `SPEC-SECURITY-AND-COMPLIANCE-PRACTICES.md` | security checks + auditable PR evidence |
| Quality and coverage policy | `TESTING-CI-AND-QUALITY.md`, CI scripts | `SPEC-LIFECYCLE-AND-WORKFLOW.md`, `SPEC-GOVERNANCE-AND-TRACEABILITY.md` | Coverage thresholds + strict pre-push |
| Gate evidence packaging | PR description, CI outputs, security outputs | `SPEC-DELIVERY-GATES-AND-EVIDENCE.md` | merge blocked when evidence is missing |

## Source Families Included

The Spec Development Driven model explicitly includes the following information families:

1. Monorepo-level documentation (`documentation/`, `README.md`)
2. Component technical documentation (`apps/*/documentation`, `packages/*/README.md`)
3. Versioned API specs (`/spec`)
4. Governance scripts and checks (`ci-cd/*`, hooks, quality configs)
5. Requirement and NFR registry (`.agents/requirements`, `.agents/NFR-REGISTRY.md`)
6. Project governance and board processes (`JUMENTIX-PROJECT-GOVERNANCE.md`, Linear Project Jumentix)

## Completeness Rule

Any new source of truth introduced in the project must be:

1. Added to `SPEC-KNOWLEDGE-SOURCE-MAP.md`
2. Mapped in this matrix
3. Bound to a validation/enforcement mechanism
