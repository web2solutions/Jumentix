@/Users/eduardoalmeida/.codex/RTK.md

# AGENTS.md - @jumentix/frontend

Este arquivo orienta agentes Codex ao trabalhar neste repositório. Ele descreve o propósito do projeto, o estado atual do código e as regras de arquitetura que devem ser seguidas em novas implementações.

## 0. Fronteira de contrato (Requirement 136 — obrigatório)

Este workspace é o frontend do Jumentix. **Aplicações frontend nunca conhecem o código do backend.** A única referência permitida ao backend é a sua documentação OAS — a representação JSON da especificação servida em runtime pelo Swagger UI do backend em execução, ou o arquivo YAML versionado da espec.

- **Proibido**: qualquer import de `apps/backend-template/**` ou de implementação backend, inclusive type-only.
- **Permitido**: pacotes públicos do workspace em `packages/**` (ex.: `@jumentix/cana`, `@jumentix/sdk-rest-client`) e SDKs gerados a partir da spec OAS — são clientes/contratos, não código do backend.
- Apps 100% offline e híbridas seguem a mesma regra: contratos consumidos como dados, nunca como código importado.

Referência normativa: `.agents/requirements/software/136-frontend-knows-backend-only-through-oas.md` no monorepo.

## 1. Propósito do Projeto

`x2-trading-system` será uma Single Page Application (SPA) em Vue 3 para gestão de domínios comerciais/operacionais, incluindo usuários, catálogo de produtos, estoque, pedidos, vendas, fornecedores e logística.

O produto final deve ser modular, offline-first e preparado para crescer por domínio de negócio, usando princípios de Domain Driven Design, Hexagonal Architecture e Clean Architecture.

## 2. Estado Atual Do Repositório

- O diretório `src` foi intencionalmente esvaziado. Ele é o local do produto final, mas ainda não contém a aplicação de produção.
- O diretório `template` é um catálogo congelado de referência visual/técnica baseado no CoreUI Vue Admin Template.
- O `template` foi migrado para TypeScript:
  - não deve haver arquivos `.js` dentro de `template/src`;
  - scripts de componentes Vue usam `lang="ts"`;
  - o template possui `tsconfig.json`, `eslint.config.mjs` e `vite.config.ts` próprios.
- O repositório raiz ainda mantém dependências/scripts do app Vue, mas o produto real deve ser reconstruído em `src`.
- Este diretório não deve ser tratado como fonte única de domínio: o domínio nascerá nas pastas obrigatórias dentro de `src`.

## 3. Separação Obrigatória: `template` vs `src`

- `template`: catálogo de exemplos / inspiração. Use como referência visual e técnica, semelhante a um storybook informal.
- `src`: produto final. Todo código de produção da SPA deve ser criado aqui.

Regras práticas:

- Não importe código diretamente de `template` para `src`.
- Não transforme `template` em dependência runtime do produto.
- Não altere `template` durante features do produto, salvo quando a tarefa for explicitamente sobre o catálogo.
- Ao copiar uma solução visual do `template`, adapte para a arquitetura de `src`; não replique o exemplo didático como regra de domínio.
- Mantenha `template/node_modules` fora do estado final do repositório. Ele pode ser recriado temporariamente para validação e removido ao final.

## 4. Stack Tecnológica

- Framework: Vue 3 / Vite.
- Linguagem para novas implementações: TypeScript.
- UI: CoreUI for Vue.js + Bootstrap 5.
- Estado: Pinia.
- Rede: Axios ou Fetch API, escolhendo conforme padrão existente quando surgir.
- Persistência: offline-first, usando IndexedDB e estado local com Pinia.
- Roteamento: Vue Router.

Observação: versões antigas dos agentes citavam JavaScript. Para o estado atual do projeto, novas implementações devem nascer em TypeScript.

## 5. Arquitetura Obrigatória Para Novas Funcionalidades

Cada nova funcionalidade em `src` deve nascer organizada por domínio no seguinte formato:

```text
src/domains/entities/<dominio>
src/domains/ports/<dominio>
src/application/usecases/<dominio>
src/adapters/<dominio>
src/features/<dominio>
src/stores
```

Responsabilidades:

- `src/domains/entities/<dominio>`: entidades e objetos de domínio puros, sem Vue, Pinia, CoreUI, browser APIs ou IndexedDB direto.
- `src/domains/ports/<dominio>`: contratos de entrada/saída do domínio. Defina interfaces para repositórios, gateways e serviços externos.
- `src/application/usecases/<dominio>`: casos de uso que orquestram entidades e ports. Não devem depender de componentes Vue.
- `src/adapters/<dominio>`: implementações concretas dos ports, incluindo IndexedDB, HTTP, storage, APIs do browser e controllers/adapters.
- `src/features/<dominio>`: UI e composição da feature em Vue. Pode usar CoreUI, Vue Router e stores.
- `src/stores`: stores Pinia globais ou por feature quando realmente necessário.

## 6. Diretrizes De Design E UI

- Use o `template` como referência de CoreUI para layout, sidebar, header, forms, tables, charts, modals, toasts e widgets.
- O produto final deve ser uma aplicação operacional, não uma landing page.
- Interfaces devem ser densas, claras e adequadas para uso repetido em dashboard/admin.
- Mantenha acessibilidade: labels, `aria-*`, foco navegável, botões semânticos e feedback de erro visível.
- Não use wrappers de documentação do template (`DocsExample`, `DocsComponents`, `DocsIcons`) no produto final.

## 7. Regras De Implementação

- Nunca instale pacotes adicionais sem permissão explícita do usuário.
- Use TypeScript para novos arquivos de produção.
- Crie testes unitários e e2e para novas funcionalidades.
- Preserve trabalho existente do usuário; não reverta alterações não solicitadas.
- Antes de criar uma feature, defina o domínio e crie a estrutura mínima correspondente.
- Mantenha domínio e aplicação independentes de Vue/CoreUI.
- Evite dados mockados dentro de componentes finais; mocks podem existir apenas em testes ou fixtures explícitas.
- Preferir aliases e padrões já configurados no projeto quando forem definidos no `src`.

## 8. Fluxo De Trabalho Para Agentes

1. Leia este arquivo e inspecione o estado atual antes de implementar.
2. Quando precisar de referência visual, consulte `template`.
3. Para novas features, crie primeiro a estrutura DDD/Hexagonal obrigatória em `src`.
4. Implemente domínio/use cases antes de UI quando houver regra de negócio.
5. Adapte a UI em `src/features/<dominio>` usando CoreUI.
6. Adicione testes unitários e e2e proporcionais ao risco da mudança.
7. Rode validações disponíveis (`lint`, `typecheck`, `build`, testes) quando existirem.
8. Ao final de tarefas complexas, atualize este arquivo se houver novo aprendizado estrutural relevante.

## 9. Estado Atual

- `src` contém o produto: engine de formulários OAS-driven, auth/RBAC, profile e o kit X-CRUD (ver seção 10) com as sub-aplicações Users e Organizations.
- `template` preservado como catálogo TypeScript de referência visual/técnica.
- Novas features continuam nascendo em `src` seguindo as seções 5 e 10.

## 10. Requisitos consolidados do produto construído em `src` (JUM-760 → JUM-772)

Estado real construído e verificado. Estes requisitos são mandatórios para qualquer agente que evolua este frontend.

### 10.1 Motor de formulários e contratos OAS (JUM-766/768/769)

- **Formulários são montados em runtime** iterando as propriedades do schema OAS bundled (`src/contracts/openapi.json`, gerado por `scripts/sync-contracts.mjs` a partir de `spec/1.0.0.yml`). Nenhum campo é estático: renomear campo/faceta na spec reflete no próximo load sem tocar componente.
- Facetas respeitadas: `type`, `format` (email, uuid, password, date), `required`, `minLength`, `maxLength`, `enum`, `pattern`, `default`, `nullable`, `description`, `example`, `readOnly`.
- `x-validation` (blocos na OAS): regras por tipo+país para `Document.data` (CPF com checksum mod-11, SSN, RG, passport) e `Phone.number` (BR/US). `contracts/validation.ts` executa as regras: máscaras progressivas, checksum antes de qualquer HTTP, mensagens amigáveis.
- **Regras pattern-only** (passport/RG) filtram o alfabeto e capam no input (`patternAlphabet`/`patternCap`/`filterDocumentData`/`documentInputCap`) — nunca "válido até falhar no save".
- `x-hide: true` na OAS remove o campo de qualquer formulário (ex.: `RequestLogin.schemaType`; o default server-side se aplica).
- `x-references` em propriedades uuid FK (ex.: `User.organization` → `getAllOrganizations`): base do `XCrudReferenceInput` e da resolução de labels (a grid/preview/gráficos mostram o **nome** da entidade referenciada, nunca o uuid cru).
- **maxlength efetivo** = `maxLength` declarado ou tamanho da máscara/cap do pattern — over-typing é bloqueado no input.
- Enums renderizam como dropdown buscável (`SearchableEnumInput`: datalist nativo + indicador ▾ + suporte a `{value,label}`); edição inline de células usa o mesmo motor.

### 10.2 Autenticação, sessão e RBAC (JUM-760/761/772)

- Login/registro seguem a OAS; `@jumentix/sdk-rest-client` é o único canal UI↔servidor (`getSharedApiClient`, singleton — alimenta o NetworkActivity widget via eventos `request:start/success/error` do SDK).
- Não autenticado → redirect automático para `/login` (guard). Rotas com `meta.operationId` passam por **scope guard**: roles vêm de `profile.record` (carregado no mount da `DefaultLayout`; `profile.load()` deduplica chamadas concorrentes — callers compartilham o mesmo flight).
- **RBAC lido da OAS**: `info.x-rbac` (matriz role→scope) + `security` por operation. `contracts/rbac.ts`: `effectiveScopes`, `can(roles, operationId)`, `hasSuperadmin`, `rbacRoleNames`. A UI esconde o que o role não pode; o backend enforça (superadmin bypassa; admin tem tenant scope; user é self-only/read).
- **Somente superadmin gerencia múltiplas organizações** (admin não tem `create_organization`/`delete_organization`).
- Seeds esperados: organização **XpertMinds**; `eduardo@xpertminds.dev` (superadmin), `admin@xpertminds.dev`, `user@xpertminds.dev` (senhas `eduardo@123456`/`admin@123456`/`user@123456`).

### 10.3 Kit X-CRUD (`src/components/x-crud/`) — padrão enterprise (referência X-SYNTH)

Componente genérico agregador, alvo de geração para qualquer domínio (pagamentos, estoque, CRM…): apps gerados emitem apenas uma `XCrudEntityConfig` por entidade (`xCrudTypes.ts`).

- **Shell**: card `border-0 shadow-sm`; pills "New ${entity} | ${entity} Listing" no card header; widgets agregadores no topo da listing; grid+forms preservam estado entre views.
- **Toolbar**: search (cil-search), quick filter de contexto (select), Delete bulk com contador de selecionados, Export JSON (linhas filtradas, client-side), Columns (visibilidade por checkbox), Refresh — botões outline sm com ícones cil.
- **Grid** (`XCrudGrid`): coluna de seleção (select-all), headers uppercase com setas de sort (asc/desc/none, tipado), **linha de filtros por coluna no thead** (enum→select, boolean→tri-state, datas→intervalo, demais→texto capado), ids truncados mono, badges coloridos com paleta estável, booleano → ✓/✗, arrays → badge de contagem, FK → label. Coluna Actions estreita com botões-ícone (preview/edit/delete por `can()`). **A coluna `id` fica oculta por default** (Columns a reexibe). Inline edit opcional por célula com confirm/cancel explícitos. Footer: "x–y de N · Rows: [per-page] · páginas numeradas · Go to". Paginação `pager` ou smart rendering `scroll`. Loading = skeleton rows; vazio = estado central.
- **Row detail**: card expansível abaixo da linha (borda primária) com tabs: "${entity} Data" (scalars, readonly), **uma tab exclusiva por campo array-de-objetos** (emails/documents/phones — tabela readonly limpa), "Edit ${entity}" (RBAC). Fechar via ✕.
- **3 formulários por entidade** (`XCrudForm`): create (pill "New"), update (tab Edit), preview (readonly, grade 4 colunas, labels da spec, sensíveis mascarados, avatar como imagem). Grade 2 colunas; arrays de scalars → checkbox group (`arrayOptions`); **arrays de objetos editáveis** via `XCrudArrayEditor` (add/remove/edit inline por item, campos com as facetas da OAS); referências via `XCrudReferenceInput`; `beforeSubmit` para mapeamentos (ex.: primaryEmail → `emails[0]`).
- **Agregadores**: widgets estilo CWidgetStatsA (fundo colorido, valor grande) + chart (`@coreui/vue-chartjs`) por faceta/`groupBy` — somente dados reais.
- Densidade/tipografia/spacing seguem o padrão enterprise compacto (linhas e células apertadas); mobile: scroll horizontal + forms 1 coluna.
- Ícones: `CIcon` por nome exige registro em `app.provide('icons', …)` no `main.ts` — **toda iconografia nova deve ser adicionada lá** (subconjunto curado; o set completo fica no template).

### 10.4 Shell

- `DefaultLayout` carrega roles no mount (nav correta em qualquer página, inclusive dashboard pós-login).
- Header usa rotas hash (`#/users`, `#/organizations`) — links absolutos quebram o hash router.
- Sidebar: `CNavGroup` com filtro RBAC por `operationId` (`_nav.ts`); item sem escopo de leitura não renderiza.

### 10.5 Testes e qualidade

- bun:test com `expect.assertions`/`expect.hasAssertions`; mocks via `globalThis.fetch` (o SDK usa fetch); sem condicionais em testes.
- Testes de drift obrigatórios: mudança na OAS (faceta, matriz rbac) deve refletir sem mudança de código.
- Gates: `bun run test` + `typecheck` + `lint` (frontend) verdes antes de qualquer entrega; gates completos do monorepo rodam nos hooks de commit/push.
