# Cana com React Context API

Construa um sistema de tarefas categorizadas partindo de um app React vazio até
uma implementação offline funcional. O app guarda categorias e tarefas no Cana,
ouve eventos confirmados e atualiza o estado do React por meio de um Context
provider.

## 1. Comece do zero

```bash
bun create vite cana-react-context --template react-ts
cd cana-react-context
bun add @jumentix/cana
```

Use duas stores:

- `categories`: categorias de tarefas com `id`, `name`, `color` e timestamps.
- `tasks`: tarefas com `categoryId`, `completed`, `priority` e timestamps.

Indexes deixam o reload da UI barato:

- `categories.byName`
- `tasks.byCategory`
- `tasks.byCompleted`
- `tasks.byUpdatedAt`

## 2. Implementação simples

Crie `src/cana.ts` e envolva o app com `TasksProvider`. O provider abre o Cana
uma vez, carrega as tabelas atuais, assina `CanaChangeEvent` e usa um reducer
para atualizar o estado dos componentes quando as escritas fazem commit.

O fluxo essencial é:

1. A UI chama `cana.table('tasks').add(...)`.
2. O Cana confirma a escrita.
3. `client.subscribe((event) => ...)` recebe o evento confirmado.
4. O reducer mapeia `created | updated | deleted | cleared` para o estado React.
5. Os componentes renderizam novamente a partir do Context.

<CanaFrameworkPlayground id="react-context-basic" />

## 3. Implementação avançada

A versão avançada adiciona o que uma UI offline séria precisa:

- uma transação `readwrite` cria categoria e primeira tarefa juntas;
- `sinceCursor` retoma um listener depois de reload;
- `isCanaErrorCode(error, 'NotFound')` detecta janela de replay expirada;
- um reload completo das tabelas repara o estado antes de assinar de novo;
- `originId` permite ignorar seu próprio eco se você também aplicar patches
  otimistas na UI.

Dentro de uma transação, mantenha o corpo limitado a trabalho Cana/IndexedDB.
Não coloque `fetch`, timers ou outro async externo dentro do callback.

<CanaFrameworkPlayground id="react-context-advanced" />

## 4. Formato final do app

A implementação final com Context fica assim:

```text
src/
  cana.ts
  TasksProvider.tsx
  advancedCana.ts
  App.tsx
```

`TasksProvider` é o único componente que sabe como eventos Cana viram estado
React. Componentes de folha ficam simples: chamam `addTask` e `toggleTask`, e
renderizam `state.categories`, `state.tasks` e `state.events`.

## 5. Checklist

- [ ] `open()` roda antes de qualquer chamada de tabela.
- [ ] O provider cancela a subscription no cleanup do `useEffect`.
- [ ] Componentes atualizam a partir de eventos Cana confirmados.
- [ ] Fluxos avançados usam `transaction()` para escritas multi-store.
- [ ] Falha de replay recarrega as tabelas antes de assinar novamente.

## Próximo

Compare com [React Redux](./react-redux) para apps maiores com slices e
selectors explícitos, ou [Vue 3 + Pinia](./vue-pinia) para o padrão de store Vue.
