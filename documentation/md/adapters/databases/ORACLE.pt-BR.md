# Adaptador Oracle

O adapter Oracle conecta o contrato de persistência do Jumentix à tecnologia Oracle. Use cases continuam falando com portas de repositório; a escolha de banco fica na composição.

## Tecnologia integrada

Oracle Database pelo perfil de cliente SQL

- **Modelo de dados:** SQL relacional
- **Driver Jumentix:** `Oracle`
- **Seleção de runtime:** `JUMENTIX_DATABASE_DRIVER=Oracle`

## Quando usar

Use quando: Sistemas enterprise já investidos em operação e governança Oracle.

## Quando evitar

Evite para apps leves em que custo operacional importa mais que compatibilidade Oracle.

## Como validar localmente

Use o smoke test real do monorepo. Ele valida o ciclo de vida do adapter e evita publicar configuração que não conecta.

```bash
bun run docker:up:oracle
JUMENTIX_DATABASE_DRIVER=Oracle bun run smoke:db:oracle
```

## Exemplo completo: Task e Category com porta de banco

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

## O que trocar em produção

O exemplo acima mostra o contrato completo com uma implementação em memória para ser lido de ponta a ponta. Em produção, a composição injeta o cliente real selecionado por `JUMENTIX_DATABASE_DRIVER=Oracle`; o domínio continua igual.
