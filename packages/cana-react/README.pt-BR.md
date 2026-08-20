# @jumentix/cana-react

Hooks React e helpers para Redux sobre `@jumentix/cana`.

## Instalação

```bash
npm install @jumentix/cana @jumentix/cana-react react
```

## Hooks

```ts
import { useCanaLiveQuery } from '@jumentix/cana-react';

const { records, status, reload } = useCanaLiveQuery<Task>({
  client,
  store: 'tasks',
  query: { index: 'byCategory', equals: categoryId },
  getKey: (task) => task.id
});
```

`useCanaLiveQuery()` carrega uma tabela Cana e mantém o estado atualizado a
partir de entradas `CanaChangeEvent` confirmadas. Quando há uma query, o hook
recarrega a tabela em eventos compatíveis, então visões filtradas continuam
corretas.

## Bridge Redux

```ts
import { connectCanaToRedux } from '@jumentix/cana-react/redux';

const bridge = connectCanaToRedux({
  client,
  dispatch: store.dispatch,
  mapEvent: (event) => ({ type: 'cana/eventCommitted', payload: event })
});
```
