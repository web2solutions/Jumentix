# @jumentix/cana-vue

Composables Vue e helpers para Pinia sobre `@jumentix/cana`.

## Instalação

```bash
npm install @jumentix/cana @jumentix/cana-vue vue
```

## Live query

```ts
import { useCanaLiveQuery } from '@jumentix/cana-vue';

const tarefas = useCanaLiveQuery<Tarefa>({
  client,
  store: 'tarefas',
  query: { index: 'porCategoria', equals: categoriaId },
  getKey: (tarefa) => tarefa.id
});
```

`useCanaLiveQuery()` carrega uma tabela e mantém uma `ref` Vue atualizada a
partir de eventos Cana confirmados. Stores Pinia podem usar o mesmo helper
`applyCanaEventToRecords()` dentro de actions.
