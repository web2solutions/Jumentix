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

## 9. Estado Esperado Após Esta Limpeza

- `src` vazio, pronto para reconstrução do produto final.
- `template` preservado como catálogo TypeScript.
- Agentes futuros devem iniciar novas features em `src` e não continuar o antigo starter CoreUI que foi removido.
