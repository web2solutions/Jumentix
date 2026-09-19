# Seed de Frontend e o Kit X-CRUD

Épico Linear: `[EPIC][Frontend] Frontend seed and X-CRUD kit hardening` (JUM-774…778, 780, 781, 782).
Requisitos `112`, `115`, `117`, `118`, `134`, `135`, `136`.

The English version is at [FRONTEND-SEED-AND-XCRUD.md](./FRONTEND-SEED-AND-XCRUD.md).

## O que é

`apps/frontend` (`@jumentix/frontend`) é o **seed dos frontends que a fábrica Jumentix gera** —
os modos *Hybrid Backend + Frontend* e *Frontend-only SPA/PWA* da
[Matriz de Capacidades da Fábrica](./JUMENTIX-SERVICE-FACTORY-CAPABILITIES-MATRIX.pt-BR.md). Está
para os frontends como `apps/backend-template` está para os backends: um produto funcional sobre o
domínio Users / Organizations que mostra o padrão que qualquer domínio gerado segue.

A regra que molda tudo (Requisito `136`): **o frontend conhece o backend só pelo documento
OpenAPI.** `scripts/sync-contracts.mjs` grava `spec/1.0.0.yml` em `src/contracts/openapi.json`; o
SDK (`@jumentix/sdk-rest-client`) é o único canal HTTP; nenhum arquivo em `src/` importa código do
backend.

## Renderização dirigida pelo contrato

| Superfície OAS | Módulo do frontend | Renderiza |
| --- | --- | --- |
| `components.schemas.*.properties` (+ `allOf`, `$ref`) | `contracts/formSchema.ts` | um `FieldDescriptor` por propriedade: formulários, colunas, filtros |
| `x-label` (`{ en, pt-BR }`) → `title` → nome humanizado | `contracts/labels.ts` | todo rótulo; `description` vira texto de ajuda sob o controle |
| `x-hide` | `formSchema.ts` | propriedade fica no contrato, nunca renderiza |
| `x-relation` (`entity`, `match`, `display`, `kind`) | `XCrudReferenceInput`, `useXCrud.loadReferences` | selects de FK que mostram o label e emitem o id; lista via `<Entity>ArrayOf`; arrays de ids (membros) resolvidos igual |
| `x-validation` | `contracts/validation.ts` | máscaras/checksums (CPF, SSN, telefones) antes de qualquer HTTP |
| `x-list-capabilities` | `contracts/listSchema.ts` | paginação/ordenação/filtro/busca no servidor (abaixo) |
| `info.x-rbac` + `security` por operação | `contracts/rbac.ts`, guards, `modules/nav.ts` | quais rotas, itens de menu e botões cada papel vê |

Os ids de operação do shell (login, register, logout, perfil) ficam em
`contracts/appOperations.ts` e são validados no boot: um app gerado com operações renomeadas falha
de forma visível em vez de renderizar uma UI vazia e sem permissões. Sub-apps declaram os seus na
`XCrudEntityConfig`.

Expiração de sessão (JUM-783, mesclado junto com este épico): `contracts/sessionGuard.ts` assina o
fluxo de eventos do SDK — um 401 em qualquer operação que não seja `auth.login` / `auth.register`
configurados expira a sessão, limpa o perfil em cache e leva a `/login` de qualquer página; o guard
do router e um timer de 30 s no `DefaultLayout` pegam um JWT cujo `exp` já passou.

## X-CRUD: dados no servidor (JUM-778)

O kit escolhe o modo de dados pelo contrato, nunca pela config do componente:

- **Modo servidor** — a operação de listagem declara `x-list-capabilities`. Cada busca / filtro /
  ordenação / troca de página vira uma requisição no
  [contrato de listagem paginada](./PAGINATED-LIST-CONTRACT.pt-BR.md) (`page`, `size`, `sort`,
  `q`, `filter` base64), e a grid mostra exatamente a página devolvida em
  `{ result, page, size, total }`. Setas de ordenação, linha de filtros e busca aparecem só para os
  campos declarados. Entrada digitada é debounced (`debounceMs`, padrão 250 ms). Página além da
  última (400 após um delete com `total` antigo) recua uma página. Agregadores: `count` sem
  `groupBy` usa o `total` do servidor; os demais são calculados sobre a página carregada e dizem
  isso ("(esta página)").
- **Modo memória** — sem capabilities: a lista inteira é carregada uma vez e os mesmos controles
  rodam em memória (operações anteriores a JUM-777).

Controles da grid (JUM-781): coluna de ações fixa (sticky) à direita, botão `Filtros` na toolbar
com a contagem ativa, filtros de intervalo de data empilhados, selects para enum/boolean, labels de
referência no lugar de uuids, timestamps formatados no locale, `id` oculto por padrão (o menu
Colunas restaura).

## i18n e rótulos (JUM-780)

`src/i18n` tem uma tabela plana de mensagens por locale (`en`, `pt-BR`), `t(key, params)` e
`localized(value)` para legendas de config (`title`, `label` de agregador, `allLabel` do filtro
rápido aceitam `{ en, 'pt-BR' }`). O locale é detectado do navegador, trocável no menu da conta e
persistido em `localStorage`. Rótulos de campo **não** são mensagens: vêm do contrato (`x-label`),
então um domínio gerado não precisa de entrada de mensagem por campo. Um teste unitário fixa que os
dois locales declaram as mesmas chaves.

## Testes (JUM-776)

- `bun run test` — `test/unit` (motor de contratos, stores, router) + `test/component`
  (`@vue/test-utils` + happy-dom montando os `.vue` reais; `test/setup/vue-sfc.ts` é um plugin Bun
  que compila SFCs com `@vue/compiler-sfc`, registrado pelo `bunfig.toml` da app). Chart.js é
  substituído por stub — precisa de canvas real — e o harness diz isso.
- `bun run test:coverage` + `bun run frontend:coverage:check` (raiz) — lcov do bun sobre `src/`
  com gate em linhas e funções (`apps/frontend/scripts/check-coverage.js`); fontes não tocadas contam
  zero; branches aparecem como *não medidos* porque o Bun não emite registros de branch
  (Requisito `110` §2). O gate roda dentro do `ci:gate`; o lcov alimenta o Sonar.
- `bun run test:e2e` — `scripts/run-e2e.mjs` constrói e sobe a REST API Express real em Docker
  (`e2e/docker-compose.yml`, imagem `oven/bun` a partir da raiz do monorepo, InMemory, com seeds),
  sobe um Vite com `/api` em proxy, roda Cypress (Chrome headless por padrão —
  `FRONTEND_E2E_BROWSER` sobrescreve; o Electron do Cypress dá segfault no macOS ao digitar nos
  inputs de senha/datalist) e derruba tudo. Sem Docker → saída diferente de zero (Requisito `118`).
- `test-map.json` registra toda suíte; a camada `frontend` depende da camada `contracts`, então
  uma mudança em `spec/1.0.0.yml` ou no SDK REST seleciona as suítes do frontend.

## Rodando

```sh
bun install                                   # raiz do monorepo
bun run dev                                   # :3001, proxy /api → :3010
VITE_DEV_PORT=3021 VITE_API_PROXY_TARGET=http://localhost:3020 bun run dev   # outras portas
bun run test && bun run typecheck && bun run lint && bun run build && bun run test:e2e
```

Contas seed: `eduardo@xpertminds.dev` / `eduardo@123456` (superadmin),
`admin@xpertminds.dev` / `admin@123456` (admin), `user@xpertminds.dev` / `user@123456` (user).

## Relacionados

- [Contrato de Listagem Paginada](./PAGINATED-LIST-CONTRACT.pt-BR.md)
- [Contrato de métricas de entidade](./ENTITY-METRICS-CONTRACT.pt-BR.md)
- [Creating SPA/PWA with Jumentix](../../apps/service-management/documentation/guides/CREATING-SPA-PWA-WITH-JUMENTIX.md)
- `apps/frontend/AGENTS.md` — regras para agentes no workspace
- `.agents/requirements/software/136-frontend-knows-backend-only-through-oas.md`

## Módulos

Um domínio gerado entrega um `ModuleManifest` (`src/modules/manifest.ts`): `id`, `title` localizável, `icon`, `entities[]` (cada uma com `XCrudEntityConfig` e `load()`) e `dashboard.load()` obrigatório. `src/modules/index.ts` registra o módulo Users (entidades `users` e `organizations` mais o `DashboardView` atual). `validateModules()` roda no boot e lista todo operationId ausente da OAS empacotada.

O menu vem do registry (`src/modules/nav.ts`). Rotas: `/m/:moduleId/:tab?`. `/users`, `/organizations` e `/dashboard` redirecionam para o módulo Users.

## Dashboards

A aba Dashboard de cada módulo (`DashboardView.vue` + `DashboardGrid.vue`) junta duas camadas:

1. **Widgets genéricos** (`src/components/dashboard/genericWidgets.ts`) derivados da OAS empacotada por entidade: `count` (mais pendentes `_sync` no modo Cana), `groupBy` para cada campo `x-metrics-capabilities.groupable`, `series` (intervalo `day`) para cada campo de série, e **fan-out** para cada `x-relation` `hasMany` cujo belongsTo inverso é groupable na entidade filha. Fonte: `GET …/metrics` no servidor; `listLocal` + `runMetricsQuery` (`@jumentix/persistence-contracts`) com Cana aberto. Ver [Contrato de métricas de entidade](./ENTITY-METRICS-CONTRACT.pt-BR.md).
2. **Widgets de domínio** em `manifest.dashboard.widgets` (`DashboardWidget`: `{ id, title, size, component, query? }`). O módulo Users registra três exemplos: membros por organização, razão admin/usuário, cadastros em 30 dias.

Um domínio gerado acrescenta widgets nesse array, com `query` apontando aos operationIds de list/metrics da OAS. `ChartCard.vue` usa Chart.js via `@coreui/vue-chartjs`, rótulos no eixo e tabela de fallback (não só cor).

## Multitarefa

O shell só monta depois do login: `DefaultLayout` não sobe (e `load()` de módulo não corre) antes da autenticação. `src/stores/tasks.ts` guarda **uma tarefa por módulo**. `open(moduleId)` ativa a tarefa já aberta. Fechar a ativa seleciona a anterior. A lista aberta e o id ativo ficam em `sessionStorage`; o estado do X-CRUD não — ele sobrevive porque cada módulo aberto permanece montado e aparece com `v-show` (`DefaultLayout.vue`).

`AppTaskbar.vue` é a barra inferior: um botão por tarefa, teclado, menu overflow, ícones compactos abaixo de `md`, switcher em bottom-sheet no `xs`. A URL aponta a tarefa ativa (`#/m/users/users`).

```
┌────────────┬──────────────────────────────┐
│            │         main toolbar         │
│   menu     ├──────────────────────────────┤
│ navegação  │      lazy load modules       │
│            │                              │
├────────────┴──────────────────────────────┤
│                  taskbar                  │
└───────────────────────────────────────────┘
```

Um módulo é um layout em abas (`ModuleLayout.vue`): uma aba por entidade que o papel pode listar, **Dashboard sempre por último**. O papel `user` vê `Usuários | Painel` e não Organizações.

## Widgets da toolbar

`src/shell/toolbarWidgets.ts` é o contrato: `{ id, component, placement, order, requiredScopes?, moduleId? }`. O shell registra account, locale, network activity e slots reservados `notifications` e `online-offline`. Um módulo pode contribuir widgets enquanto a tarefa está ativa. Abaixo de `md` os widgets que não são a conta caem no menu overflow.

## Responsivo

Tokens em `src/styles/breakpoints.scss` e `src/shell/breakpoints.ts` (CoreUI/Bootstrap). Menu offcanvas abaixo de `lg`. Taskbar compacta abaixo de `md`. Abas do módulo com scroll horizontal. Alvos de toque ≥ 44 px. Cypress `shell-responsive.cy.ts` confere `scrollWidth <= innerWidth` em 375×812, 768×1024 e 1280×800.
