# Contrato de autorização de tenant e RBAC

## Escopo

Esta tabela de decisão é uma referência derivada para acesso por tenant no domínio Users.
As fontes canônicas são `User.ts`, `Organization.ts`, `Rbac.ts` e
`TenantAuthorizationPolicy.ts`. O OpenAPI e este documento devem seguir esses arquivos
de domínio. Os escopos de permissão são verificados primeiro por `Authorize`; em seguida,
a política de tenant restringe uma operação permitida.

## Classes de principal

| Principal | Regra de organização | Limite de dados |
|---|---|---|
| `superadmin` | Opcional | Global |
| `admin` | Obrigatória | Própria organização |
| `user` | Obrigatória | Próprio usuário e própria organização |
| Principal legado com escopos diretos | Não é uma função de tenant normalizada | Limite global retrocompatível, restrito pelos escopos explícitos |
| Visitante ou identidade ausente | Não aplicável | Sem acesso protegido |

Escopos diretos legados preservam o comportamento global definido por `Rbac.ts`.
Eles não adquirem implicitamente a semântica de tenant de `admin` ou `user`.

## Tabela de decisão por operação

| Operação | `superadmin` | `admin` | `user` | Escopos diretos legados |
|---|---|---|---|---|
| Criar organização | Permitir | Permitir por `create_organization` | Negar pelos escopos da função | Permitir quando houver escopo explícito `create_organization` |
| Listar/ler organização | Qualquer organização | Própria organização | Própria organização quando o escopo permitir | Qualquer organização quando o escopo explícito permitir |
| Alterar/excluir organização | Qualquer organização | Própria organização quando o escopo permitir | Negar pelos escopos da função | Qualquer organização quando o escopo explícito permitir |
| Criar usuário | Qualquer organização ou sem vínculo | Própria organização; organização ausente é vinculada automaticamente | Negar pelos escopos da função | Qualquer organização ou sem vínculo quando o escopo explícito permitir |
| Listar usuários | Todos os usuários | Usuários da própria organização | Apenas o próprio usuário | Todos os usuários quando o escopo explícito permitir |
| Ler/alterar um usuário | Qualquer usuário | Usuário da própria organização quando o escopo permitir | Apenas o próprio usuário quando o escopo permitir | Qualquer usuário quando o escopo explícito permitir |

## Regras de negação

1. Uma operação de `admin` ou `user` normalizado sem organização falha com
   `organization scope is required`.
2. Um alvo fora da organização do principal falha com
   `cross organization access is forbidden`.
3. Um `user` normalizado que tente acessar outro usuário falha com
   `user scope is restricted to the authenticated user`.
4. Falhas de escopo/função continuam sob responsabilidade de `Authorize` e preservam
   a mensagem existente `user must have the <scope> role`.

## Aplicação e evidências

- Arquivos de domínio são a fonte da verdade; OpenAPI, adaptadores, fixtures e
  documentação são representações derivadas.
- Decisões puras de tenant pertencem a `modules/Users/domain/security`.
- Controllers aplicam as decisões após autenticação e antes da execução do caso de uso.
- Adaptadores HTTP compartilham os mesmos controllers e devem retornar resultados equivalentes.
- Testes positivos e negativos devem cobrir acesso global, mesmo tenant, tenant diferente,
  próprio usuário e organização ausente.

Requisitos relacionados: `029`, `031`, `044`, `071`, `072` e `076`.
