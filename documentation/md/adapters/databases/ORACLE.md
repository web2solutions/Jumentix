# Oracle Adapter

The Oracle adapter connects the Jumentix persistence contract to Oracle. Use cases keep talking to repository ports; database selection stays in composition.

## Integrated technology

Oracle Database through the SQL client profile

- **Data model:** Relational SQL
- **Jumentix driver:** `Oracle`
- **Runtime selection:** `JUMENTIX_DATABASE_DRIVER=Oracle`

## When to use

Use it for: Enterprise systems already invested in Oracle operations and governance.

## When to avoid

Avoid for lightweight apps where operational cost matters more than Oracle compatibility.

## How to validate locally

Use the real monorepo smoke test. It validates the adapter lifecycle and prevents shipping configuration that does not connect.

```bash
bun run docker:up:oracle
JUMENTIX_DATABASE_DRIVER=Oracle bun run smoke:db:oracle
```

## Complete example: Task and Category with a database port

```ts
type Category = {
  id: string;
  name: string;
};

type Task = {
  id: string;
  title: string;
  categoryId: string;
  completed: boolean;
};

type Repository<T extends { id: string }> = {
  create(record: T): Promise<T>;
  getById(id: string): Promise<T | undefined>;
  list(): Promise<T[]>;
};

function createRepository<T extends { id: string }>(): Repository<T> {
  const records = new Map<string, T>();

  return {
    async create(record) {
      records.set(record.id, record);
      return record;
    },
    async getById(id) {
      return records.get(id);
    },
    async list() {
      return [...records.values()];
    }
  };
}

const adapterProfile = {
  driver: 'Oracle',
  dataModel: 'Relational SQL',
  smokeTest: 'bun run smoke:db:oracle'
} as const;

const categories = createRepository<Category>();
const tasks = createRepository<Task>();

export async function seedTaskCatalog() {
  const operations = await categories.create({ id: crypto.randomUUID(), name: 'Operations' });
  const finance = await categories.create({ id: crypto.randomUUID(), name: 'Finance' });

  await tasks.create({
    id: crypto.randomUUID(),
    title: 'Review adapter smoke test',
    categoryId: operations.id,
    completed: false
  });

  await tasks.create({
    id: crypto.randomUUID(),
    title: 'Close billing reconciliation',
    categoryId: finance.id,
    completed: true
  });

  return { adapterProfile, categories: await categories.list(), tasks: await tasks.list() };
}

export async function listTasksForCategory(categoryId: string): Promise<Task[]> {
  const category = await categories.getById(categoryId);

  if (!category) {
    throw new Error('Category not found');
  }

  return (await tasks.list()).filter((task) => task.categoryId === category.id);
}
```

## What changes in production

The example above shows the full contract with an in-memory implementation so it can be read end to end. In production, composition injects the real client selected by `JUMENTIX_DATABASE_DRIVER=Oracle`; the domain stays the same.
