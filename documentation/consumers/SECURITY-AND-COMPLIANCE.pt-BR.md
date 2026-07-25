# Segurança e Compliance para Consumidores

Jumentix inclui guardrails de segurança voltados à entrega enterprise.

## Baseline de segurança

- Controles RBAC e escopo por tenant
- Política de exposição de erros por ambiente
- Suporte a middlewares de segurança em adaptadores HTTP
- Caminhos de hardening de autenticação (políticas de token, lockout e revogação)

## Entrega orientada a compliance

- Checks de qualidade e segurança no CI integrados aos gates de entrega
- Modelo de governança rastreável com tarefas de projeto e evidências em PRs
- Abordagem contract-first que melhora consistência e auditabilidade de APIs

## Prática recomendada para consumidores

Use os gates de CI e contratos de documentação do Jumentix como critérios obrigatórios de release no pipeline do seu produto.
