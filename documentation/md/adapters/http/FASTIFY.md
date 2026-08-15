# Fastify Adapter

The Fastify adapter connects the Fastify runtime to Jumentix HTTP contracts. It stays at the edge: receive the request, normalize input, call use cases, and map the result back to a response.

## Integrated technology

High-performance Node.js HTTP framework with plugin encapsulation and schema-first request handling.

- **Runtime model:** Long-running Node/Bun process
- **Jumentix contract:** handlers call controllers/use cases without leaking framework types into the domain.

## When to use

Use it for: APIs with high request volume, strong validation boundaries, and predictable plugin composition.

## When to avoid

Avoid when the team needs maximum Express middleware compatibility.

## How to start or compose

Real entrypoint:

- `apps/backend-template/src/interface/HTTP/adapters/fastify/fastify.ts`
- `apps/backend-template/src/interface/HTTP/adapters/start-rest-api.ts` when the adapter uses environment-driven bootstrap

Available monorepo commands:

```bash
bun run dev:fastify
bun run prod:fastify
```

## Complete example: Task and Category at the HTTP edge

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

type CreateTaskRequest = {
  title: string;
  categoryId: string;
};

type HttpRequest = {
  body: unknown;
};

type HttpResponse = {
  status: number;
  body: unknown;
};

const adapterProfile = {
  adapter: 'fastify',
  framework: 'Fastify',
  runtime: 'Long-running Node/Bun process',
  entrypoint: 'apps/backend-template/src/interface/HTTP/adapters/fastify/fastify.ts',
  developmentCommand: 'bun run dev:fastify',
  productionCommand: 'bun run prod:fastify'
} as const;

class TaskCatalog {
  private readonly categories = new Map<string, Category>();
  private readonly tasks = new Map<string, Task>();

  createCategory(name: string): Category {
    const category = { id: crypto.randomUUID(), name };
    this.categories.set(category.id, category);
    return category;
  }

  createTask(input: CreateTaskRequest): Task {
    if (!this.categories.has(input.categoryId)) {
      throw new Error('Category not found');
    }

    const task = {
      id: crypto.randomUUID(),
      title: input.title.trim(),
      categoryId: input.categoryId,
      completed: false
    };
    this.tasks.set(task.id, task);
    return task;
  }

  listTasksByCategory(categoryId: string): Task[] {
    return [...this.tasks.values()].filter((task) => task.categoryId === categoryId);
  }
}

const catalog = new TaskCatalog();
const delivery = catalog.createCategory('Delivery');
const finance = catalog.createCategory('Finance');

catalog.createTask({ title: 'Prepare invoice batch', categoryId: finance.id });

export async function createTaskController(request: HttpRequest): Promise<HttpResponse> {
  const input = request.body as Partial<CreateTaskRequest>;

  if (!input.title || !input.categoryId) {
    return { status: 400, body: { error: 'title and categoryId are required' } };
  }

  try {
    const task = catalog.createTask({ title: input.title, categoryId: input.categoryId });
    return { status: 201, body: { adapterProfile, task } };
  } catch (error) {
    return {
      status: 404,
      body: { error: error instanceof Error ? error.message : 'Unknown error' }
    };
  }
}

export async function listDeliveryTasksController(): Promise<HttpResponse> {
  return {
    status: 200,
    body: { category: delivery, tasks: catalog.listTasksByCategory(delivery.id) }
  };
}
```

## Adoption checklist

- The adapter stays inside the HTTP layer.
- Controllers receive normalized data and call use cases.
- `Task` and `Category` belong to the domain, not the framework.
- Errors are mapped to responses at the edge.
