# Primeiros passos com Cana

Esta página monta o menor banco Cana útil para um app de tarefas categorizadas.
Ela cria duas tabelas, grava dados iniciais e lê os registros de volta.

## Instalação

```bash
bun add @jumentix/cana
```

## App mínimo completo de tarefas

```ts
import { createClient, type CanaSchema } from '@jumentix/cana';

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

const schema: CanaSchema = {
  version: 1,
  stores: [
    {
      name: 'categories',
      keyPath: 'id',
      indexes: [{ name: 'byName', keyPath: 'name', unique: true }]
    },
    {
      name: 'tasks',
      keyPath: 'id',
      indexes: [
        { name: 'byCategory', keyPath: 'categoryId' },
        { name: 'byCompleted', keyPath: 'completed' },
        { name: 'byUpdatedAt', keyPath: 'updatedAt' }
      ]
    }
  ]
};

const client = createClient({
  name: 'tasks-app',
  schema,
  originId: 'tasks-page'
});

await client.open();

const now = Date.now();
await client.table<Category>('categories').bulkAdd([
  { id: 'work', name: 'Work', color: '#2563eb', createdAt: now, updatedAt: now },
  { id: 'home', name: 'Home', color: '#16a34a', createdAt: now, updatedAt: now }
]);

await client.table<Task>('tasks').add({
  id: 'task-1',
  title: 'Write the Cana tutorial',
  categoryId: 'work',
  completed: false,
  priority: 'high',
  createdAt: now,
  updatedAt: now
});

const categories = await client.table<Category>('categories').query({ index: 'byName' });
const tasks = await client.table<Task>('tasks').query({ index: 'byUpdatedAt' });

console.log({ backend: client.backend, categories, tasks });
```

## O que observar

- `open()` é explícito. O Cana não esconde upgrade de schema atrás de um `get()`
  ou `put()` sem relação.
- `client.backend` informa qual backend de storage abriu, útil para diagnóstico.
- Nomes de tabela são strings porque atravessam fronteiras de worker e
  IndexedDB. Mantenha nomes estáveis e pequenos: `categories`, `tasks`.
- Estado de UI não fica no Cana. Guarde estado renderizado em React, Redux,
  Pinia ou outra camada de UI, e grave dados duráveis pelo Cana.

## Execute aqui

<CanaPlayground id="getting-started" />

## Próximo

Continue em [schema e chaves](./CANA-USAGE-SCHEMA-KEYS.pt-BR.md) antes de adicionar mais tabelas.
