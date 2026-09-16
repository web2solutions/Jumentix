# @jumentix/frontend

Seed dos frontends que a fábrica Jumentix gera — os modos *Hybrid Backend + Frontend* e
*Frontend-only SPA/PWA* da matriz da fábrica. Uma SPA administrativa enterprise dirigida pela OAS
(Vue 3 + Vite + CoreUI + Pinia) sobre o domínio Users / Organizations do `apps/backend-template`.

The English version is at [README.md](./README.md).
Descrição técnica completa: [Seed de Frontend e o Kit X-CRUD](../../documentation/md/FRONTEND-SEED-AND-XCRUD.pt-BR.md).

## Fronteira de contrato (Requisito 136)

O frontend conhece o backend **só pelo documento OpenAPI**. `scripts/sync-contracts.mjs` grava
`spec/1.0.0.yml` em `src/contracts/openapi.json` (`predev`/`prebuild`); o SDK
`@jumentix/sdk-rest-client` é o único canal HTTP. Importar de `apps/backend-template/**` — mesmo
type-only — é proibido e pego por `arch:check-workspace-boundaries`.

## O que renderiza a partir do contrato

- **Formulários** de `components.schemas` (`type`, `format`, `required`, tamanhos, `enum`,
  `pattern`, `default`, `nullable`); `x-hide` tira a propriedade de todo formulário.
- **Rótulos** de `x-label` (`{ en, 'pt-BR' }`) → `title` → nome humanizado; `description` é texto
  de ajuda sob o controle.
- **Validação** de `x-validation` (CPF mod-11, SSN, telefones BR/US, limites de pattern) antes de
  qualquer HTTP.
- **Referências** de `x-references`: selects mostram o label referenciado e emitem o id; arrays de
  ids (membros de organização) também resolvem para labels.
- **RBAC** de `info.x-rbac` + `security` por operação: rotas, itens de menu e botões seguem os
  papéis logados; o backend aplica.
- **Listagens** de `x-list-capabilities`: o kit X-CRUD pede páginas ao servidor
  ([Contrato de Listagem Paginada](../../documentation/md/PAGINATED-LIST-CONTRACT.pt-BR.md)) e
  renderiza ordenação, filtro e busca só para os campos declarados; sem a extensão, volta ao modo
  memória.

## Superfície

- **Auth** — login/cadastro montados de `RequestLogin`/`RequestRegister`; não autenticado vai para
  `/login`; rotas com guarda de escopo (`meta.operationId`); sessão rejeitada cai em `/login`.
- **Dashboard** — totais reais dos envelopes de listagem e os papéis/organização logados; "sem
  acesso" honesto para papéis sem escopo de leitura.
- **Users / Organizations** — sub-apps X-CRUD: listagem no servidor (busca, filtros por coluna,
  ordenação, pager ou scroll), row detail com uma tab por campo array, formulários
  create/update/preview com editores de array, exclusão em massa, exportação, visibilidade de
  colunas, agregadores.
- **Perfil** — escalares, e-mails, documentos, telefones a partir dos schemas de sub-recurso.
- **i18n** — `en` e `pt-BR`, trocável no menu da conta, persistido por navegador.

## Layout

```text
src/contracts/   motor OAS: formSchema, oasForm, validation, labels, listSchema, rbac,
                 apiClient, appOperations, errors, openapi.json (gerado)
src/components/  OasFormField, SearchableEnumInput, x-crud/* (XCrud, grid, toolbar, forms,
                 row detail, array editor, reference input, panels, chart, useXCrud)
src/features/    auth, dashboard, profile, users, organizations
src/stores/      auth, profile, network, entityStore, sidebar, theme
src/i18n/        messages (en, pt-BR), t(), localized(), useI18n()
template/        catálogo CoreUI congelado — só referência, nunca importado
test/unit        bun:test — motor de contratos, stores, router, estado do kit
test/component   @vue/test-utils + happy-dom montando os .vue reais
cypress/e2e      Cypress contra o backend em contêiner (e2e/docker-compose.yml)
```

## Comandos

```sh
bun install                 # na raiz do monorepo
bun run dev                 # vite em :3001, /api em proxy para :3010
                            # VITE_DEV_PORT / VITE_API_PROXY_TARGET sobrescrevem
bun run build               # vite build
bun run test                # suítes unit + component
bun run test:coverage       # grava coverage/frontend/lcov.info (raiz: frontend:coverage:check)
bun run test:e2e            # backend em Docker + Vite + Cypress (Chrome headless por padrão)
bun run typecheck && bun run lint
```

Contas seed de dev: `eduardo@xpertminds.dev` / `eduardo@123456` (superadmin),
`admin@xpertminds.dev` / `admin@123456`, `user@xpertminds.dev` / `user@123456`.

Regras para agentes neste workspace: [AGENTS.md](./AGENTS.md).
