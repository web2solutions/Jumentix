# Cana with Vanilla TypeScript

Build the same categorized task app without React, Vue, or a helper package.
Cana owns durable IndexedDB state; a plain `Map` (or DOM render) owns UI state.

## 1. Start from zero

```bash
bun create vite cana-vanilla-ts --template vanilla-ts
cd cana-vanilla-ts
bun add @jumentix/cana
```

Use two stores:

- `categories`: task buckets with `id`, `name`, `color`, timestamps.
- `tasks`: records with `categoryId`, `completed`, `priority`, timestamps.

Indexes make reloads cheap:

- `categories.byName`
- `tasks.byCategory`
- `tasks.byCompleted`
- `tasks.byUpdatedAt`

## 2. Create the client

`src/cana.ts`:

```ts
import { createClient, type CanaSchema } from '@jumentix/cana';

export type Category = {
  id: string;
  name: string;
  color: string;
  createdAt: number;
  updatedAt: number;
};

export type Task = {
  id: string;
  title: string;
  categoryId: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  createdAt: number;
  updatedAt: number;
};

export const schema: CanaSchema = {
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

export const client = createClient({
  name: 'tasks-app-vanilla',
  schema,
  originId: 'vanilla-ui'
});
```

## 3. Wire UI state from committed events

`src/main.ts`:

```ts
import {
  isCanaErrorCode,
  type CanaChangeEvent
} from '@jumentix/cana';
import { client, type Category, type Task } from './cana';

const categories = new Map<string, Category>();
const tasks = new Map<string, Task>();

function applyEvent(event: CanaChangeEvent): void {
  const key = String(event.key);
  if (event.store === 'categories') {
    if (event.type === 'cleared') {
      categories.clear();
      return;
    }
    if (event.type === 'deleted') {
      categories.delete(key);
      return;
    }
    categories.set(key, event.value as Category);
    return;
  }
  if (event.store === 'tasks') {
    if (event.type === 'cleared') {
      tasks.clear();
      return;
    }
    if (event.type === 'deleted') {
      tasks.delete(key);
      return;
    }
    tasks.set(key, event.value as Task);
  }
}

function render(): void {
  const root = document.querySelector<HTMLElement>('#app');
  if (!root) return;
  const taskList = [...tasks.values()]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map((task) => {
      const category = categories.get(task.categoryId)?.name ?? task.categoryId;
      return `<li data-id="${task.id}">
        <label>
          <input type="checkbox" ${task.completed ? 'checked' : ''} />
          ${task.title} <small>(${category})</small>
        </label>
      </li>`;
    })
    .join('');
  root.innerHTML = `
    <h1>Tasks</h1>
    <form id="add-task">
      <input name="title" placeholder="New task" required />
      <button type="submit">Add</button>
    </form>
    <ul id="tasks">${taskList}</ul>
  `;

  root.querySelector('#add-task')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const title = new FormData(form).get('title');
    if (typeof title !== 'string' || title.trim() === '') return;
    const now = Date.now();
    try {
      await client.table<Task>('tasks').add({
        id: `task-${now}`,
        title: title.trim(),
        categoryId: 'work',
        completed: false,
        priority: 'medium',
        createdAt: now,
        updatedAt: now
      });
      form.reset();
    } catch (error) {
      if (isCanaErrorCode(error, 'QuotaExceeded')) {
        console.warn('Storage quota is full');
        return;
      }
      throw error;
    }
  });

  root.querySelectorAll<HTMLInputElement>('#tasks input[type="checkbox"]').forEach((input) => {
    input.addEventListener('change', async () => {
      const id = input.closest('li')?.dataset.id;
      if (!id) return;
      const task = tasks.get(id);
      if (!task) return;
      await client.table<Task>('tasks').put({
        ...task,
        completed: input.checked,
        updatedAt: Date.now()
      });
    });
  });
}

async function boot(): Promise<void> {
  await client.open();

  const existingCategories = await client.table<Category>('categories').query({ index: 'byName' });
  const existingTasks = await client.table<Task>('tasks').query({ index: 'byUpdatedAt' });
  for (const category of existingCategories) categories.set(category.id, category);
  for (const task of existingTasks) tasks.set(task.id, task);

  if (categories.size === 0) {
    const now = Date.now();
    await client.transaction('readwrite', ['categories', 'tasks'], async (tx) => {
      await tx.table<Category>('categories').bulkAdd([
        { id: 'work', name: 'Work', color: '#2563eb', createdAt: now, updatedAt: now },
        { id: 'home', name: 'Home', color: '#16a34a', createdAt: now, updatedAt: now }
      ]);
      await tx.table<Task>('tasks').add({
        id: 'task-1',
        title: 'Write the Cana tutorial',
        categoryId: 'work',
        completed: false,
        priority: 'high',
        createdAt: now,
        updatedAt: now
      });
    });
  }

  client.subscribe((event) => {
    applyEvent(event);
    render();
  });

  render();
}

boot().catch((error) => {
  console.error(error);
});
```

Flow:

1. UI calls `client.table('tasks').add(...)`.
2. Cana commits the write.
3. `subscribe` receives the committed `CanaChangeEvent`.
4. `applyEvent` updates the `Map`.
5. `render()` paints the DOM from the maps.

## 4. Atomic multi-store write

Creating a category with its first task must stay in one transaction:

```ts
await client.transaction('readwrite', ['categories', 'tasks'], async (tx) => {
  const now = Date.now();
  await tx.table<Category>('categories').add({
    id: 'errands',
    name: 'Errands',
    color: '#ca8a04',
    createdAt: now,
    updatedAt: now
  });
  await tx.table<Task>('tasks').add({
    id: `task-${now}`,
    title: 'Buy sugarcane',
    categoryId: 'errands',
    completed: false,
    priority: 'low',
    createdAt: now,
    updatedAt: now
  });
});
```

Do not put `fetch`, timers, or unrelated async work inside the callback.

## 5. Checklist

- [ ] `open()` runs before any table call.
- [ ] UI state is patched from committed events (or a full reload after seed).
- [ ] Multi-store writes use `transaction()`.
- [ ] Errors use `isCanaErrorCode`, not `instanceof`.
- [ ] Tear-down unsubscribes if the page can remount without a full reload.

## Next

- [Integrate with any framework](./any-framework.md) — same pattern for React, Vue, Svelte, …
- [Transactions and change events](./transactions-events.md) — replay windows and `originId`.
- [Storage and crash recovery](./storage-recovery.md) — `resolveWrite()` for `unknown` outcomes.
