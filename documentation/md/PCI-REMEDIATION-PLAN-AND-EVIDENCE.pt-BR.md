<!--
Arquivo gerado automaticamente a partir de: documentation/md/PCI-REMEDIATION-PLAN-AND-EVIDENCE.md
Idioma alvo: Português (Brasil)
-->
# Plano de remediação de PCI e evidências de auditoria

Este documento define o plano de remediação na ordem do sprint e mapeia as evidências técnicas necessárias para a auditoria.

## Plano de sprint (P0/P1/P2)

### P0 - Controles de risco obrigatórios

1. Controle de acesso e escopo do locatário RBAC
   - Aplicar o escopo da organização para operações vinculadas ao locatário.
   - Aplicar caminhos de negação entre organizações.
   - Evidência:
     - `apps/backend-template/src/modules/Users/adapters/in/http/controllers/UserController.ts`
     - `apps/backend-template/test/unit/modules/Users/interface/controller/controllers.test.ts`

2. Controles de risco de autenticação
   - Janelas de bloqueio de login e rastreamento de tentativas malsucedidas.
   - Comportamento de revogação de token ao sair.
   - Evidência:
     - `apps/backend-template/src/modules/Users/service/AuthService.ts`
     - `apps/backend-template/test/unit/modules/Users/service/AuthService.branches.test.ts`

3. Política de exposição a erros internos por ambiente
   - `dev/staging`: inclui detalhes internos para depuração.
   - `produção`: máscara interna.
   - Evidência:
     - `apps/backend-template/src/shared/utils.ts`
     - `apps/backend-template/src/interface/HTTP/adapters/*/responses/sendErrorResponse.ts`

4. Base de segurança dos transportes
   - Estratégia de lista de permissões CORS via ambiente.
   - Middleware de cabeçalhos de segurança habilitado onde o adaptador o suporta.
   - Evidência:
     - `apps/backend-template/src/config/security.ts`
     - `apps/backend-template/src/interface/HTTP/adapters/express/ExpressServer.ts`
     - `apps/backend-template/src/interface/HTTP/adapters/fastify/FastifyServer.ts`

### P1 - Reforço de estabilidade e compatibilidade

1. Compatibilidade de autenticação baseada no ambiente
   - Ativação de autenticação básica controlada.
   - Comportamento do portador primeiro e mascaramento de credenciais de produção.
   - Evidência:
     - `apps/backend-template/src/config/.env.dev`
     - `apps/backend-template/src/config/.env.staging`
     - `apps/backend-template/src/config/.env.ci`
     - `ci-cd/loadEnvironment.js`

2. Endurecimento do contrato JWT
   - Suporte ao emissor/público e uso de token-id para caminho de revogação.
   - Evidência:
     - `apps/backend-template/src/infra/jwt/JwtService.ts`
     - cobertura da unidade de serviço de autenticação.

3. Prova de qualidade
   - O portão local da CI verifica fiapos, verificações de limites, testes, resolução de rotas da OEA, construção e fumaça.
   - Comando de evidência:
     - `pnpm executar ci:gate`

### P2 - Controles de maturidade operacional (concluído)

1. Coletor centralizado de auditoria de segurança
   - Persista eventos de auditoria para adaptador dedicado com política de retenção.
   - Status: implementado com adaptador oficial na memória e fiação de autenticação/autorização.
   - Evidência:
     - `apps/backend-template/src/infra/audit/InMemorySecurityAuditRepository.ts`
     - `apps/backend-template/src/infra/audit/ISecurityAuditRepository.ts`
     - `apps/backend-template/src/modules/Users/service/AuthService.ts`
     - `apps/backend-template/test/unit/infra/audit/InMemorySecurityAuditRepository.test.ts`
     - `apps/backend-template/test/unit/modules/Users/service/AuthService.audit.test.ts`
2. Runbooks de segurança de produção
   - Rotação de chaves, resposta a incidentes e procedimento de exportação de auditoria.
   - Situação: documentada.
   - Evidência:
     - `documentação/md/SECURITY-RUNBOOK-PCI.md`
3. Verificações de fumaça de segurança em CI
   - Trabalho explícito que afirma mascaramento de erros de produção e comportamento de negação de CORS.
   - Status: implementado via `pnpm run ci:security-smoke` e incluído em `pnpm run ci:gate`.

## Lista de verificação de evidências de auditoria

- [x] Portão de fiapos passou.
- [x] Testes unitários aprovados com limites rigorosos.
- [x] As verificações de arquitetura e limite de dependência foram aprovadas.
- [x] Verificação de resolução de rota OpenAPI aprovada.
- [x] Verificação de compilação aprovada.
- [x] A verificação de fumaça de integração foi aprovada.
- [x] Verificação de fumaça de segurança aprovada (`ci:security-smoke`).
- [x] Referências de código de controle de segurança documentadas.
- [x] Requisito cadastrado em `.agents`.
