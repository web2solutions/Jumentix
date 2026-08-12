# @jumentix/cana-react

React hooks and Redux-friendly helpers for `@jumentix/cana`.

## Install

```bash
npm install @jumentix/cana @jumentix/cana-react react
```

## Hooks

```ts
import { useCanaLiveQuery } from '@jumentix/cana-react';

const { records, status, reload } = useCanaLiveQuery<Tarefa>({
  client,
  store: 'tarefas',
  query: { index: 'porCategoria', equals: categoriaId },
  getKey: (tarefa) => tarefa.id
});
```

`useCanaLiveQuery()` loads a Cana table and keeps it updated from committed
`CanaChangeEvent` entries. When a query is present it reloads the table on
matching events, so filtered views stay correct.

## Redux bridge

```ts
import { connectCanaToRedux } from '@jumentix/cana-react/redux';

const bridge = connectCanaToRedux({
  client,
  dispatch: store.dispatch,
  mapEvent: (event) => ({ type: 'cana/eventCommitted', payload: event })
});
```
