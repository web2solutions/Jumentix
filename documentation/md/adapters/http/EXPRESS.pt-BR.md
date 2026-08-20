# Adaptador Express

O adapter Express conecta o runtime Express aos contratos HTTP do Jumentix. Ele fica na borda: recebe request, normaliza entrada, chama use cases e transforma o resultado em response.

## Tecnologia integrada

Framework HTTP minimalista para Node.js com middlewares, routers e ecossistema amplo.

- **Modelo de runtime:** Processo Node/Bun de longa duração
- **Contrato Jumentix:** handlers chamam controllers/use cases sem vazar tipos do framework para o domínio.

## Quando usar

Use quando: Times que querem a borda REST mais familiar e muitas opções de middleware prontas.

## Quando evitar

Evite quando throughput de requests e validação orientada a schema forem o critério principal.

## Como iniciar ou compor

Ponto de entrada real:

- `apps/backend-template/src/interface/HTTP/adapters/express/express.ts`
- `apps/backend-template/src/interface/HTTP/adapters/start-rest-api.ts` quando o adapter usa bootstrap por ambiente

Comandos disponíveis no monorepo:

```bash
bun run dev:express
bun run prod:express
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
  adapter: 'express',
  framework: 'Express',
  runtime: 'Long-running Node/Bun process',
  entrypoint: 'apps/backend-template/src/interface/HTTP/adapters/express/express.ts',
  developmentCommand: 'bun run dev:express',
  productionCommand: 'bun run prod:express'
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
