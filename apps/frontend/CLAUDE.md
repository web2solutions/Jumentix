@/Users/eduardoalmeida/.codex/RTK.md

# CLAUDE.md - @jumentix/frontend

Este arquivo orienta agentes Claude e outros assistentes ao trabalhar neste repositório. Ele deve ser mantido alinhado com `AGENTS.md`.

## 0. Fronteira de contrato (Requirement 136 — obrigatório)

Este workspace é o frontend do Jumentix. **Aplicações frontend nunca conhecem o código do backend.** A única referência permitida ao backend é a sua documentação OAS — a representação JSON da especificação servida em runtime pelo Swagger UI do backend em execução, ou o arquivo YAML versionado da espec.

- **Proibido**: qualquer import de `apps/backend-template/**` ou de implementação backend, inclusive type-only.
- **Permitido**: pacotes públicos do workspace em `packages/**` (ex.: `@jumentix/cana`, `@jumentix/sdk-rest-client`) e SDKs gerados a partir da spec OAS — são clientes/contratos, não código do backend.
- Apps 100% offline e híbridas seguem a mesma regra: contratos consumidos como dados, nunca como código importado.

Referência normativa: `.agents/requirements/software/136-frontend-knows-backend-only-through-oas.md` no monorepo.

## 1. Propósito do Projeto

`x2-trading-system` será uma SPA em Vue 3 para gestão de domínios comerciais/operacionais, como usuários, catálogo de produtos, estoque, pedidos, vendas, fornecedores e logística.

A aplicação deve ser modular, offline-first e organizada por domínios de negócio. A arquitetura-alvo combina Domain Driven Design, Hexagonal Architecture, Clean Architecture e, quando fizer sentido, padrões event-driven.

## 2. Estado Atual Do Repositório

- `src` está intencionalmente vazio. Ele representa o produto final e deve ser reconstruído do zero.
- `template` é um catálogo congelado de referência visual/técnica baseado em CoreUI Vue Admin Template.
- `template` está migrado para TypeScript e validado com lint, typecheck, build e browser.
- `template` não é runtime do produto. Ele existe para consulta, inspiração e exemplos de CoreUI.
- `template/node_modules` não deve permanecer no estado final; recrie apenas temporariamente se precisar validar o catálogo.

## 3. Separação Obrigatória: `template` vs `src`

- `template`: catálogo de exemplos / inspiração, semelhante a um storybook informal.
- `src`: produto final, único local para código de produção.

Regras:

- Não importar código de `template` em `src`.
- Não usar componentes `DocsExample`, `DocsComponents` ou `DocsIcons` no produto final.
- Não editar `template` durante desenvolvimento de domínio, exceto se a tarefa pedir explicitamente alterações no catálogo.
- Quando usar o `template` como inspiração, adaptar o padrão visual para a arquitetura limpa do `src`.

## 4. Stack Tecnológica

- Vue 3 / Vite.
- TypeScript para novas implementações.
- CoreUI for Vue.js.
- Bootstrap 5.
- Pinia.
- Vue Router.
- Axios ou Fetch API.
- IndexedDB para persistência offline-first.

## 5. Arquitetura Alvo

Paradigmas:

- Domain Driven Design.
- Hexagonal Architecture.
- Clean Architecture.
- Clean code.
- Event-driven quando houver fluxo assíncrono, sincronização offline ou integração entre domínios.

Cada nova funcionalidade deve nascer com esta estrutura:

```text
src/domains/entities/<dominio>
src/domains/ports/<dominio>
src/application/usecases/<dominio>
src/adapters/<dominio>
src/features/<dominio>
src/stores
```

Responsabilidades:

- `domains/entities`: regras e estruturas puras de domínio.
- `domains/ports`: interfaces/contratos para entrada e saída do domínio.
- `application/usecases`: orquestração de regras e fluxos de aplicação.
- `adapters`: implementações concretas de ports, incluindo IndexedDB, HTTP, storage e integrações.
- `features`: telas, componentes e composição Vue da funcionalidade.
- `stores`: stores Pinia compartilhadas ou específicas quando necessárias.

## 6. Regras De Domínio

- Entidades não devem importar Vue, CoreUI, Pinia, router, IndexedDB ou APIs de browser.
- Use cases não devem depender de componentes ou detalhes de UI.
- Adapters podem depender de infraestrutura concreta.
- Features Vue podem depender de stores, use cases, CoreUI e router.
- Validações de negócio devem ficar em domínio/use cases, não apenas em componentes.
- Estados derivados de UI devem ficar próximos da feature; estados compartilhados devem ir para Pinia.

## 7. Diretrizes De UI

- Consulte `template` para padrões CoreUI de layout, sidebar, header, forms, tabelas, charts, modals, toasts e widgets.
- O produto final deve parecer uma ferramenta operacional/admin.
- Priorize clareza, densidade organizada, acessibilidade e uso repetido.
- Não criar landing page como tela inicial do produto, salvo pedido explícito.
- Todo formulário deve ter labels, feedback de erro e navegação por teclado.

## 8. Testes E Validação

- Sempre criar testes unitários e e2e para novas funcionalidades.
- Testes de domínio/use cases devem cobrir regras de negócio sem Vue.
- Testes e2e devem cobrir fluxos reais da feature.
- Rode as validações disponíveis antes de finalizar:
  - lint;
  - typecheck, quando configurado;
  - build;
  - testes unitários/e2e, quando existirem.

## 9. Restrições

- Nunca instalar pacotes adicionais sem permissão explícita.
- Não reintroduzir o antigo starter CoreUI dentro de `src`.
- Não deixar `template/node_modules` como artefato final.
- Não alterar arquivos fora do escopo sem necessidade.
- Não remover trabalho do usuário que não esteja relacionado à tarefa.

## 10. Estado Esperado Para Próximos Agentes

Ao iniciar uma nova tarefa, considere:

- `src` é uma área limpa para o produto final.
- `template` é o catálogo TypeScript de referência.
- A primeira feature real deve criar a base mínima da aplicação em `src`, incluindo entrypoint Vue, roteamento, layout e estrutura por domínio.
- Qualquer domínio novo deve seguir a árvore obrigatória DDD/Hexagonal antes de receber UI final.
