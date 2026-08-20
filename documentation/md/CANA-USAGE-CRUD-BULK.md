# Reading, writing and bulk operations

Use the single-record methods for UI actions and bulk methods for setup,
imports, sync batches and migrations.

## Single-record writes

```ts
type Task = {
  id: string;
  title: string;
  categoryId: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  createdAt: number;
  updatedAt: number;
};

const tasks = client.table<Task>('tasks');

await tasks.add({
  id: 'task-1',
  title: 'Draft the tutorial',
  categoryId: 'work',
  completed: false,
  priority: 'high',
  createdAt: 1,
  updatedAt: 1
});

await tasks.update('task-1', {
  completed: true,
  updatedAt: 2
});

const afterUpdate = await tasks.get('task-1');
await tasks.delete('task-1');
const afterDelete = await tasks.get('task-1');

console.log({ afterUpdate, afterDelete });
```

## Method choice

| Method | Existing key | Missing key | Best use |
| --- | --- | --- | --- |
| `add(record)` | Fails with `ConstraintViolation`. | Inserts. | Create-only actions. |
| `put(record)` | Replaces the whole record. | Inserts. | Upsert from sync/import. |
| `update(key, changes)` | Merges fields. | Fails with `NotFound`. | UI edits that must not resurrect deleted rows. |
| `delete(key)` | Deletes. | No stored record remains. | Remove actions. |
| `clear()` | Removes every record in the store. | Store becomes empty. | Reset/import flows. |

## Bulk writes

```ts
type Category = {
  id: string;
  name: string;
  color: string;
  createdAt: number;
  updatedAt: number;
};

const now = Date.now();
const categories = client.table<Category>('categories');
const tasks = client.table<Task>('tasks');

await categories.bulkAdd([
  { id: 'work', name: 'Work', color: '#2563eb', createdAt: now, updatedAt: now },
  { id: 'home', name: 'Home', color: '#16a34a', createdAt: now, updatedAt: now }
]);

const insertedKeys = await tasks.bulkAdd([
  {
    id: 'task-1',
    title: 'Write the guide',
    categoryId: 'work',
    completed: false,
    priority: 'high',
    createdAt: now,
    updatedAt: now
  },
  {
    id: 'task-2',
    title: 'Review examples',
    categoryId: 'home',
    completed: false,
    priority: 'medium',
    createdAt: now,
    updatedAt: now + 1
  }
]);

console.log({ insertedKeys });
```

`bulkAdd()` is still one IndexedDB transaction. If a record violates a
constraint, the error names the store and the operation so the caller can report
the batch failure without guessing.

## Run it here

<CanaPlayground id="crud" />

<CanaPlayground id="bulk" />

## Next

Continue to [querying and plans](./CANA-USAGE-QUERYING.md).
