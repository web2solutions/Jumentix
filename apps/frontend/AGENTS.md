# AGENTS.md - @jumentix/frontend

Este arquivo orienta agentes ao trabalhar neste workspace. As regras operacionais do monorepo
(`rtk`, Caveman, Linear, registry, gates) estão em `../../AGENTS.md`, `../../CLAUDE.md` e
`../../documentation/md/AGENT-RTK-AND-CAVEMAN-GUIDE.md`; aqui ficam só as regras do frontend.

## 0. Fronteira de contrato (Requirement 136 — obrigatório)

**Aplicações frontend nunca conhecem o código do backend.** A única referência permitida ao
backend é a sua documentação OAS — a representação JSON servida em runtime pelo Swagger UI do
backend ou o arquivo YAML versionado (`spec/1.0.0.yml`).

- **Proibido**: qualquer import de `apps/backend-template/**` ou de implementação backend,
  inclusive type-only.
- **Permitido**: pacotes do workspace em `packages/**` (ex.: `@jumentix/sdk-rest-client`,
  `@jumentix/cana`) e SDKs gerados a partir da OAS — são clientes/contratos, não código do backend.
- Apps 100% offline e híbridas seguem a mesma regra: contratos consumidos como dados.

Referência normativa: `.agents/requirements/software/136-frontend-knows-backend-only-through-oas.md`.

## 1. Propósito

`@jumentix/frontend` é o **seed dos frontends gerados pela fábrica Jumentix** — os modos
*Hybrid Backend + Frontend* e *Frontend-only SPA/PWA* da
`documentation/md/JUMENTIX-SERVICE-FACTORY-CAPABILITIES-MATRIX.md`. Ele demonstra, sobre o
domínio Users/Organizations do `backend-template`, o padrão que qualquer domínio gerado
(pagamentos, estoque, CRM…) deve seguir: tudo renderizado em runtime a partir da OAS empacotada.

## 2. Estado atual

- `src/` **é o produto**: SPA Vue 3 + Vite + CoreUI 5 + Pinia, hash router.
- `template/` é o catálogo CoreUI congelado (TypeScript) — referência visual, nunca importado.
- Contrato: `scripts/sync-contracts.mjs` grava `spec/1.0.0.yml` em `src/contracts/openapi.json`
  (`predev`/`prebuild`). Único canal HTTP: `@jumentix/sdk-rest-client` (alias para o source do
  pacote em `vite.config.mjs`/`tsconfig.json`).

## 3. Layout de `src/`

```text
src/contracts/     motor OAS: formSchema (descritores), oasForm (collect/validate), validation
                   (x-validation: máscaras/checksums), labels (x-label → title → humanize),
                   listSchema (x-list-capabilities), metricsSchema (x-metrics-capabilities),
                   rbac (info.x-rbac + security), apiClient (singleton SDK), appOperations
                   (operationIds do shell), errors
src/data/          Cana schema/boot, repositório local, sync, outbox, PWA
src/modules/       manifest, Users module registry, nav generated from modules
src/shell/         toolbar widget registry, breakpoints
src/components/    OasFormField, SearchableEnumInput, X-CRUD, AppTaskbar, ModuleLayout,
                   dashboard (DashboardGrid, ChartCard, genericWidgets)
src/features/      auth, dashboard, profile, users, organizations
src/stores/        auth, profile, network, entityStore, sidebar, theme, tasks
src/i18n/          messages (en, pt-BR) + t()/localized()/useI18n()
src/router/        rotas + guards (auth + escopo por meta.operationId / aba do módulo)
```

A estrutura DDD/hexagonal por domínio (`domains/`, `application/`, `adapters/`) descrita nas
primeiras versões deste arquivo **não** foi adotada: neste seed o "domínio" é a OAS e o kit
X-CRUD é a camada de aplicação genérica. Ao gerar um domínio novo, crie `features/<dominio>/` com
uma `XCrudEntityConfig` e uma view — nada de regra de negócio duplicada no frontend.

## 4. Stack

Vue 3.5 / Vite 8 / TypeScript / CoreUI for Vue 5 + Bootstrap 5 / Pinia 3 / Vue Router 5.
Bun (pinado no monorepo) para instalar, testar e rodar. Sem dependências novas sem permissão
explícita do usuário.

## 5. Regras de implementação

1. Nenhum campo, coluna, filtro, ordenação, label ou permissão hardcoded: tudo vem da OAS
   (`properties`, `x-label`, `x-hide`, `x-relation`, `x-validation`, `x-list-capabilities`,
   `info.x-rbac`, `security`).
2. Textos de UI passam por `t()` (`src/i18n/messages.ts`, chaves iguais em `en` e `pt-BR`).
   Labels de campo **não** entram nas mensagens: vêm de `x-label` (fallback `title`, depois nome
   humanizado); `description` é texto de ajuda.
3. `operationId`s do shell (login/register/logout/profile) ficam em `contracts/appOperations.ts`,
   validados no boot contra a OAS; sub-apps X-CRUD declaram os seus na `XCrudEntityConfig`.
4. Ícones `CIcon` por nome exigem registro em `app.provide('icons', …)` em `src/main.ts`.
5. Sem dados mock em componentes finais (o dashboard mostra métricas reais da OAS, widgets de domínio, ou "sem acesso").
6. Não editar `template/`.
7. Um domínio gerado entra como `ModuleManifest` em `src/modules/` (`registerModule` + `validateModules` no boot). O menu lista **módulos**, não entidades avulsas. Entidades viram abas em `ModuleLayout.vue`.
8. Widgets da toolbar passam por `src/shell/toolbarWidgets.ts` (`registerToolbarWidget`). Não plugar componentes soltos em `AppHeader.vue`. Widgets do Dashboard passam por `manifest.dashboard.widgets` + `src/components/dashboard/` (ver `documentation/md/FRONTEND-SEED-AND-XCRUD.md` secção Dashboards).
9. Estado de um módulo aberto vive no pane (`v-show` em `DefaultLayout`); o store `tasks` só persiste quais módulos estão abertos e qual está ativo (`sessionStorage`).
10. Offline-first: IndexedDB abre antes do login; listagens após o sync leem Cana. Ver `documentation/md/FRONTEND-OFFLINE-DATA-LAYER.md`.

## 6. Kit X-CRUD (`src/components/x-crud/`)

Alvo de geração: uma `XCrudEntityConfig` por entidade (`xCrudTypes.ts`). Comportamento
decidido pelo **contrato**, não pela config:

- **Modo servidor** — a operação de listagem declara `x-list-capabilities`: cada busca/filtro/
  ordenação/página vira uma requisição (`page`, `size`, `sort`, `q`, `filter` base64 JSON) e a
  grid mostra exatamente a página devolvida no envelope `{ result, page, size, total }`.
  Setas de ordenação, linha de filtros e busca aparecem só para os campos declarados; entrada
  digitada é debounced (`debounceMs`, padrão 250). Página inexistente (400 após delete) recua
  uma página.
- **Modo memória** — sem `x-list-capabilities`: lista inteira carregada uma vez, controles em
  memória (operações anteriores a JUM-777).
- Grid: seleção, headers com labels do contrato, coluna `id` oculta por padrão, coluna de ações
  **sticky** à direita, filtros por coluna (enum→select, boolean→tri-state, data→intervalo
  empilhado, texto→contains), badges, referências (`x-relation`) resolvidas para labels —
  inclusive arrays de ids (membros de organização).
- Row detail: tab de dados, uma tab por array de objetos, tab Edit (RBAC). Datas formatadas no
  locale.
- Formulários: create / update / preview, `XCrudArrayEditor` (arrays de objetos com labels do
  item schema), `XCrudReferenceInput` (mostra label, emite id), texto de ajuda sob o campo.
- Agregadores: `count` sem `groupBy` usa o `total` do servidor; os demais são calculados sobre a
  página carregada e dizem "(esta página)".

## 7. Testes

- `bun run test` = `test/unit` (bun:test) + `test/component` (`@vue/test-utils` + happy-dom
  montando os `.vue` reais; o loader SFC para Bun está em `test/setup/vue-sfc.ts`, registrado em
  `bunfig.toml`). Toda suíte declara `expect.hasAssertions()`/`expect.assertions(n)`; mocks só
  em `globalThis.fetch`; sem `sleep` como sincronização.
- `bun run test:coverage` gera `coverage/frontend/lcov.info`; `bun run frontend:coverage:check`
  (raiz) aplica o gate de linhas/funções (`apps/frontend/scripts/check-coverage.js`). Bun não emite
  branches — o gate diz isso em vez de contar como atingido.
- `bun run test:e2e` sobe o backend real em Docker (`e2e/docker-compose.yml`), um Vite com proxy
  e roda Cypress (Chrome headless por padrão; `FRONTEND_E2E_BROWSER` para trocar). Falha fechado
  sem Docker.
- Gates antes de entregar: `bun run test`, `typecheck`, `lint`, `build`, `test:e2e`.

## 8. Rodar localmente

```sh
bun install                      # na raiz
bun run dev                      # :3001, proxy /api → :3010 (VITE_DEV_PORT / VITE_API_PROXY_TARGET)
bun run build && bun run preview
```

Contas seed: `eduardo@xpertminds.dev` / `eduardo@123456` (superadmin), `admin@xpertminds.dev`
/ `admin@123456`, `user@xpertminds.dev` / `user@123456`.
