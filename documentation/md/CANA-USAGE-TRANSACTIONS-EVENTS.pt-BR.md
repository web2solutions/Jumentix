# Transações e eventos de mudança

Transações são a fronteira de commit. Eventos de mudança são emitidos somente
depois que a transação IndexedDB completa, então subscribers nunca reagem a
dados que depois sofrem rollback.

## Transação multi-store

```ts
type Category = {
  id: string;
  name: string;
  color: string;
  createdAt: number;
  updatedAt: number;
};

type Task = {
  id: string;
  title: string;
  categoryId: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  createdAt: number;
  updatedAt: number;
};

const result = await client.transaction('readwrite', ['categories', 'tasks'], async (scope) => {
  const now = Date.now();
  await scope.table<Category>('categories').put({
    id: 'ops',
    name: 'Operations',
    color: '#f97316',
    createdAt: now,
    updatedAt: now
  });
  await scope.table<Task>('tasks').put({
    id: 'ops-1',
    title: 'Create the operations category',
    categoryId: 'ops',
    completed: false,
    priority: 'high',
    createdAt: now,
    updatedAt: now
  });
  return { categoryId: 'ops', taskId: 'ops-1' };
});

console.log({
  outcome: result.outcome,
  result: result.result,
  events: result.events
});
```

Não espere rede, timers ou trabalho de UI dentro do corpo da transação. A
transação IndexedDB faz auto-commit quando o event loop cede sem uma requisição
IndexedDB pendente. O Cana reporta isso como `TransactionInactive`.

## Ouvir eventos commitados

```ts
import type { CanaChangeEvent } from '@jumentix/cana';

const events: Array<Pick<CanaChangeEvent, 'cursor' | 'type' | 'store' | 'key'>> = [];

const stop = client.subscribe((event) => {
  events.push({
    cursor: event.cursor,
    type: event.type,
    store: event.store,
    key: event.key
  });
});

await client.table<Task>('tasks').update('ops-1', {
  completed: true,
  updatedAt: Date.now()
});

stop();
console.log(events);
```

## Replay depois que a UI ficou ausente

```ts
import { isCanaErrorCode, type CanaChangeEvent } from '@jumentix/cana';

let lastCursor = Number(localStorage.getItem('tasks:lastCursor') ?? 0);

function applyEventToUiStore(event: CanaChangeEvent) {
  lastCursor = event.cursor;
  localStorage.setItem('tasks:lastCursor', String(lastCursor));
  console.log(`${event.cursor}: ${event.type} ${event.store}/${String(event.key)}`);
}

try {
  const stop = client.subscribe(applyEventToUiStore, { sinceCursor: lastCursor });
  window.addEventListener('beforeunload', () => stop(), { once: true });
} catch (error) {
  if (isCanaErrorCode(error, 'NotFound')) {
    const categories = await client.table<Category>('categories').query({ index: 'byName' });
    const tasks = await client.table<Task>('tasks').query({ index: 'byUpdatedAt' });
    console.log({ reloadRequired: true, categories, tasks });
  } else {
    throw error;
  }
}
```

Replay é limitado por `retainedEvents`. Quando o cursor é antigo demais, o Cana
se recusa a fingir que o replay está completo. Recarregue a tabela e assine
novamente.

## Execute aqui

<CanaPlayground id="transactions" />

<CanaPlayground id="change-events" />

## Próximo

Continue em [hooks e erros](./CANA-USAGE-HOOKS-ERRORS.pt-BR.md).
