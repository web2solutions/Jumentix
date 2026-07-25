<!--
Arquivo gerado automaticamente a partir de: documentation/md/SPEC-TEMPLATES-AND-CHECKLISTS.md
Idioma alvo: Português (Brasil)
-->
# Modelos de especificações e listas de verificação

Use esses modelos para todas as alterações que priorizam as especificações.

## Modelo A - Especificações do recurso

```md
# Feature Spec - <title>

## Context
- Business objective:
- User impact:
- Scope:

## Contracts
- OpenAPI operations affected:
- AsyncAPI channels/events affected:
- Message/Event contracts affected:
- Error contracts affected:

## Architecture Impact
- Domains:
- Use cases:
- Ports/adapters:
- Boundary risks:

## Data Impact
- Entities/models/value objects changed:
- Validation/type/format updates:
- Migration/compatibility notes:

## Runtime/Deployment Impact
- Env vars:
- PM2/runtime changes:
- Cloud/deploy implications:

## Security and Compliance
- RBAC/tenant scope impact:
- Secret/sensitive data handling:
- Error exposure behavior:

## Test Strategy
- Unit:
- Integration:
- Smoke:
- Coverage target confirmation:

## Governance
- Issue:
- Project item:
- Priority/Estimate:
- Acceptance criteria:
```

## Modelo B - Especificação de alteração de contrato

```md
# Contract Change Spec - <title>

## Contract Type
- OpenAPI / AsyncAPI / Message Contract / Error Contract

## Previous Behavior
- ...

## New Behavior
- ...

## Compatibility
- Backward compatible? yes/no
- Consumer impact:
- SDK impact:

## Validation
- Route/channel resolution evidence:
- Contract test evidence:
```

## Modelo C - NFR/especificações de governança

```md
# NFR Spec - <title>

## NFR Category
- performance / security / compliance / reliability / governance / operability

## Requirement Statement
- ...

## Enforcement
- CI/CD checks:
- Runtime controls:
- Process controls:

## Evidence
- Metrics/logs/tests:
- Required docs updates:
- Required registry updates:
```

## Checklist de entrega (obrigatório)

Antes de relações públicas:

1. O problema existe e está vinculado ao item do projeto.
2. Os campos do projeto estão preenchidos.
3. Arquivos de especificações atualizados para todos os contratos/comportamentos alterados.
4. Revisão do impacto da arquitetura e dos limites.
5. Testes implementados por perfil de risco.
6. Limites de cobertura satisfeitos.
7. Documentação atualizada (incluindo links de índice).
8. Arquivos de requisitos/NFR `.agents` atualizados quando aplicável.
9. A descrição do PR inclui rastreabilidade e evidências.

Antes de mesclar:

1. Portas CI verdes.
2. Porta de cobertura de patch verde.
3. Verificações de segurança/conformidade em verde.
4. Item do projeto movido para `Concluído` com referências de evidências.


