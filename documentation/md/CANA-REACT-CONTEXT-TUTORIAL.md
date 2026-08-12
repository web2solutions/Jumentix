# Cana with React Context API

Build a categorized task system from an empty React app to a working offline
implementation. The app stores categories and tasks in Cana, listens to
committed Cana events, and updates React state through a Context provider.

## 1. Start from zero

```bash
bun create vite cana-react-context --template react-ts
cd cana-react-context
bun add @jumentix/cana @jumentix/cana-react
```

Use two stores:

- `categorias`: task buckets with `id`, `nome`, `cor`, timestamps.
- `tarefas`: records with `categoriaId`, `concluida`, `prioridade`, timestamps.

Indexes make the UI cheap to reload:

- `categorias.porNome`
- `tarefas.porCategoria`
- `tarefas.porConcluida`
- `tarefas.porAtualizadaEm`

## 2. Simple implementation

Create `src/cana.ts`, then wrap the app with `TarefasProvider`. The provider opens
Cana once, loads the current tables, subscribes to `CanaChangeEvent`, and uses a
reducer to patch component state when writes commit.

The important part is this flow:

1. UI calls `cana.table('tarefas').add(...)`.
2. Cana commits the write.
3. `client.subscribe((event) => ...)` receives the committed event.
4. The reducer maps `created | updated | deleted | cleared` to React state.
5. Components re-render from Context state.

<CanaFrameworkPlayground id="react-context-basic" />

## 3. Advanced implementation

The advanced version adds the parts you need in a serious offline UI:

- one `readwrite` transaction creates a category and its first task together;
- `sinceCursor` resumes a listener after a reload;
- `isCanaErrorCode(error, 'NotFound')` detects an expired replay window;
- a full table reload repairs state before resubscribing;
- `originId` gives you a safe place to ignore your own echo if you also apply
  optimistic UI patches.

Inside a transaction, keep the body limited to Cana/IndexedDB work. Do not put
`fetch`, timers, or unrelated async work inside the transaction callback.

<CanaFrameworkPlayground id="react-context-advanced" />

## 4. Final app shape

The finished Context implementation has this shape:

```text
src/
  cana.ts
  TarefasProvider.tsx
  advancedCana.ts
  App.tsx
```

`TarefasProvider` is the only component that knows how Cana events become React
state. Leaf components stay boring: they call `adicionarTarefa` and
`alternarTarefa`, then render `state.categorias`, `state.tarefas`, and
`state.eventos`.

Download the complete Vite app used by the advanced example:
[cana-react-context.zip](/downloads/cana/cana-react-context.zip).

## 5. Checklist

- [ ] `open()` runs before any table call.
- [ ] The provider unsubscribes in the `useEffect` cleanup.
- [ ] Components update from committed Cana events.
- [ ] Advanced flows use `transaction()` for multi-store writes.
- [ ] Replay failure reloads from tables before resubscribing.

## Next

Compare this with [React Redux](./react-redux) for larger apps with explicit
slices and selectors, or [Vue 3 + Pinia](./vue-pinia) for the Vue store pattern.
