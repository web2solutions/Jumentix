# Adaptador Vercel Functions

O adapter Vercel Functions conecta o runtime Vercel Functions aos contratos HTTP do Jumentix. Ele fica na borda: recebe request, normaliza entrada, chama use cases e transforma o resultado em response.

## Tecnologia integrada

Funções HTTP serverless publicadas junto de aplicações e roteamento da Vercel.

- **Modelo de runtime:** Handler serverless por request
- **Contrato Jumentix:** handlers chamam controllers/use cases sem vazar tipos do framework para o domínio.

## Quando usar

Use quando: APIs próximas ao frontend, times que já publicam pela Vercel e escala por rota.

## Quando evitar

Evite para workloads que precisam de supervisão customizada de processo ou estado persistente em memória.

## Como iniciar ou compor

Ponto de entrada real:

- `apps/backend-template/src/interface/HTTP/adapters/vercel-functions/vercel-functions.ts`
- `apps/backend-template/src/interface/HTTP/adapters/start-rest-api.ts` quando o adapter usa bootstrap por ambiente

Este adapter é composto pelo runtime/plataforma e não tem script dedicado de `dev:*`.

```bash
# This adapter is composed by its platform runtime.
# Keep controllers framework-free and wire them from the adapter entrypoint.
```

## Exemplo completo: Task e Category na borda HTTP

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
  adapter: 'vercel-functions',
  framework: 'Vercel Functions',
  runtime: 'Serverless request handler',
  entrypoint: 'apps/backend-template/src/interface/HTTP/adapters/vercel-functions/vercel-functions.ts'
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

## Checklist de adoção

- O adapter fica restrito à camada HTTP.
- Controllers recebem dados normalizados e chamam use cases.
- `Task` e `Category` pertencem ao domínio, não ao framework.
- Erros são convertidos para responses na borda.
