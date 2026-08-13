# Cana with React Redux

Build the same categorized task system with Redux Toolkit. Cana remains the
durable offline source, and Redux becomes the render cache that receives
committed Cana events.

## 1. Start from zero

```bash
bun create vite cana-react-redux --template react-ts
cd cana-react-redux
bun add @jumentix/cana @jumentix/cana-react @reduxjs/toolkit react-redux
```

The schema is the same as the Context tutorial: `categories` and `tasks`, with
indexes for name, category, completed state, and updated time.

## 2. Simple implementation

Create slices for `categories`, `tasks`, and `events`. The write actions still
write to Cana. The listener is what keeps Redux current:

```ts
const stop = client.subscribe((event) => {
  store.dispatch(applyCanaEvent(event));
});
```

This keeps the rule simple: Redux renders what Cana has committed. Button clicks
do not mutate the store directly unless you intentionally add optimistic UI.

<CanaFrameworkPlayground id="react-redux-basic" />

## 3. Advanced implementation

The advanced Redux version adds:

- a thunk that writes category and first task in one Cana transaction;
- a listener that dispatches `applyCanaEvent`;
- a stored `lastCursor`;
- a replay path using `subscribe(..., { sinceCursor })`;
- a reload path when Cana reports `NotFound` for an old cursor;
- an error slice that stores plain `CanaError` data.

This pattern scales well because reducers stay deterministic while thunks own
side effects.

<CanaFrameworkPlayground id="react-redux-advanced" />

## 4. Final app shape

```text
src/
  cana.ts
  store.ts
  App.tsx
```

Use selectors for derived views:

- tasks by category;
- incomplete tasks;
- recent changes from `events`.

Download the complete Vite app used by the advanced example:
[cana-react-redux.zip](/downloads/cana/cana-react-redux.zip).

## 5. Checklist

- [ ] Store initialization loads Cana tables once.
- [ ] `client.subscribe` dispatches record-level updates.
- [ ] Thunks write to Cana, reducers update from committed events.
- [ ] Transaction results are checked before showing success.
- [ ] Replay gaps reload the canonical tables.

## Next

Use [React Context](./react-context) when the state surface is small. Use
[Vue 3 + Pinia](./vue-pinia) when building the same offline pattern in Vue.
