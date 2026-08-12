# Cana with Vue 3 and Pinia

Build the categorized task system with Vue 3 and Pinia. Cana owns durable
browser storage, while Pinia owns the reactive state that components render.

## 1. Start from zero

```bash
bun create vite cana-vue-pinia --template vue-ts
cd cana-vue-pinia
bun add @jumentix/cana pinia
```

Register Pinia in `main.ts`, create `src/cana.ts`, then define task stores under
`src/stores`.

## 2. Simple implementation

The simple store action `init()` opens Cana, loads the current tables, and
returns the unsubscribe function from `client.subscribe`.

Components call store actions:

- `tasks.addTask(title, categoryId)`
- `tasks.toggle(task)`

The store patches its arrays from `CanaChangeEvent`, so every component using the
store re-renders from committed storage state.

<CanaFrameworkPlayground id="vue-pinia-basic" />

## 3. Advanced implementation

The advanced store keeps `lastCursor` in `localStorage`, subscribes with
`sinceCursor`, and reloads all tables when the replay cursor is no longer
available. It also writes category and first task in one Cana transaction.

Use `onUnmounted(() => stop())` in components or teardown logic so old views do
not keep applying events after navigation.

<CanaFrameworkPlayground id="vue-pinia-advanced" />

## 4. Final app shape

```text
src/
  cana.ts
  main.ts
  App.vue
  stores/
    tasks.ts
    advancedTasks.ts
  components/
    CategoryColumn.vue
    TaskComposer.vue
```

Pinia getters should hold derived views such as tasks by category, not duplicated
copies of Cana data.

## 5. Checklist

- [ ] `createPinia()` is installed before components use stores.
- [ ] `init()` opens Cana, loads tables, then subscribes.
- [ ] `onUnmounted` unsubscribes listeners.
- [ ] Store actions write to Cana and state patches from committed events.
- [ ] Advanced flows reload from tables when replay is unavailable.

## Next

Compare the same model in [React Context](./react-context) and
[React Redux](./react-redux).
