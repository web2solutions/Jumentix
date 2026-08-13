export type CanaSnippet = {
  id: string;
  title: { en: string; 'pt-BR': string };
  description: { en: string; 'pt-BR': string };
  code: string;
};

const schemaSource = `{
  version: 1,
  stores: [
    { name: 'categories', keyPath: 'id', indexes: [{ name: 'byName', keyPath: 'name', unique: true }] },
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
}`;

const seedSource = `const now = Date.now();
await client.table('categories').bulkAdd([
  { id: 'work', name: 'Work', color: '#2563eb', createdAt: now, updatedAt: now },
  { id: 'home', name: 'Home', color: '#16a34a', createdAt: now, updatedAt: now }
]);
await client.table('tasks').bulkAdd([
  {
    id: 'task-1',
    title: 'Write the Cana tutorial',
    categoryId: 'work',
    completed: false,
    priority: 'high',
    createdAt: now,
    updatedAt: now
  },
  {
    id: 'task-2',
    title: 'Review category filters',
    categoryId: 'home',
    completed: true,
    priority: 'medium',
    createdAt: now,
    updatedAt: now + 1
  }
]);`;

/**
 * Public-feature playground catalog. Snippets are modern JS (no TypeScript
 * syntax) so the browser can run them after a light wrap — `cana` is injected.
 */
export const CANA_SNIPPETS: readonly CanaSnippet[] = [
  {
    id: 'getting-started',
    title: { en: 'Getting started', 'pt-BR': 'Primeiros passos' },
    description: {
      en: 'Open a client, create Category and Task records, then read them back.',
      'pt-BR': 'Abra um client, crie registros Category e Task, depois leia de volta.'
    },
    code: `const client = cana.createClient({
  name: dbName,
  schema: ${schemaSource}
});
await client.open();
await client.table('categories').add({
  id: 'work',
  name: 'Work',
  color: '#2563eb',
  createdAt: Date.now(),
  updatedAt: Date.now()
});
await client.table('tasks').add({
  id: 'task-1',
  title: 'Write the Cana tutorial',
  categoryId: 'work',
  completed: false,
  priority: 'high',
  createdAt: Date.now(),
  updatedAt: Date.now()
});
return {
  backend: client.backend,
  category: await client.table('categories').get('work'),
  task: await client.table('tasks').get('task-1')
};`
  },
  {
    id: 'schema-versioning',
    title: { en: 'Schema upgrade', 'pt-BR': 'Upgrade de schema' },
    description: {
      en: 'Start with Category, then raise the version and add the Task table.',
      'pt-BR': 'Comece com Category, depois suba a versao e adicione a tabela Task.'
    },
    code: `const v1 = cana.createClient({
  name: dbName,
  schema: {
    version: 1,
    stores: [{ name: 'categories', keyPath: 'id' }]
  }
});
await v1.open();
await v1.table('categories').add({ id: 'work', name: 'Work' });
await v1.close();

const v2 = cana.createClient({
  name: dbName,
  schema: ${schemaSource}
});
await v2.open();
await v2.table('tasks').add({
  id: 'task-1',
  title: 'Created after upgrade',
  categoryId: 'work',
  completed: false,
  priority: 'medium',
  createdAt: Date.now(),
  updatedAt: Date.now()
});
return {
  categories: await v2.table('categories').query(),
  tasks: await v2.table('tasks').query()
};`
  },
  {
    id: 'keys',
    title: { en: 'Keys', 'pt-BR': 'Chaves' },
    description: {
      en: 'Use stable ids in Category and Task records.',
      'pt-BR': 'Use ids estaveis nos registros Category e Task.'
    },
    code: `const client = cana.createClient({
  name: dbName,
  schema: ${schemaSource}
});
await client.open();
await client.table('categories').add({
  id: 'docs',
  name: 'Docs',
  color: '#0f766e',
  createdAt: 1,
  updatedAt: 1
});
await client.table('tasks').add({
  id: 'docs-1',
  title: 'Document stable keys',
  categoryId: 'docs',
  completed: false,
  priority: 'medium',
  createdAt: 2,
  updatedAt: 2
});
return {
  categoryKey: 'docs',
  taskKey: 'docs-1',
  task: await client.table('tasks').get('docs-1')
};`
  },
  {
    id: 'crud',
    title: { en: 'CRUD', 'pt-BR': 'CRUD' },
    description: {
      en: 'Create, read, update and delete one Task.',
      'pt-BR': 'Crie, leia, atualize e remova uma Task.'
    },
    code: `const client = cana.createClient({
  name: dbName,
  schema: ${schemaSource}
});
await client.open();
await client.table('categories').add({ id: 'work', name: 'Work', color: '#2563eb' });
const tasks = client.table('tasks');
await tasks.add({
  id: 'task-1',
  title: 'Draft the tutorial',
  categoryId: 'work',
  completed: false,
  priority: 'high',
  createdAt: 1,
  updatedAt: 1
});
await tasks.update('task-1', { completed: true, updatedAt: 2 });
const afterUpdate = await tasks.get('task-1');
await tasks.delete('task-1');
return { afterUpdate, afterDelete: await tasks.get('task-1') };`
  },
  {
    id: 'bulk',
    title: { en: 'Bulk operations', 'pt-BR': 'Operacoes em lote' },
    description: {
      en: 'Seed Category and Task records with bulk operations.',
      'pt-BR': 'Popule Category e Task com operacoes em lote.'
    },
    code: `const client = cana.createClient({
  name: dbName,
  schema: ${schemaSource}
});
await client.open();
${seedSource}
const put = await client.table('tasks').bulkPut([
  {
    id: 'task-2',
    title: 'Review category filters',
    categoryId: 'home',
    completed: false,
    priority: 'high',
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  {
    id: 'task-3',
    title: 'Publish the example app',
    categoryId: 'work',
    completed: false,
    priority: 'medium',
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
]);
return {
  put,
  categories: await client.table('categories').query({ index: 'byName' }),
  tasks: await client.table('tasks').query({ index: 'byUpdatedAt' })
};`
  },
  {
    id: 'query-explain',
    title: { en: 'Query + explain', 'pt-BR': 'Query + explain' },
    description: {
      en: 'Run an indexed Task query by Category and inspect the plan.',
      'pt-BR': 'Rode uma query indexada de Task por Category e inspecione o plano.'
    },
    code: `const client = cana.createClient({
  name: dbName,
  schema: ${schemaSource}
});
await client.open();
${seedSource}
const { records, plan } = await client.table('tasks').explain({
  index: 'byCategory',
  equals: 'work'
});
return { records, plan };`
  },
  {
    id: 'transactions',
    title: { en: 'Transactions', 'pt-BR': 'Transacoes' },
    description: {
      en: 'Create one Category and its first Task in a single commit.',
      'pt-BR': 'Crie uma Category e sua primeira Task em um unico commit.'
    },
    code: `const client = cana.createClient({
  name: dbName,
  schema: ${schemaSource}
});
await client.open();
const tx = await client.transaction('readwrite', ['categories', 'tasks'], async (scope) => {
  const now = Date.now();
  await scope.table('categories').put({
    id: 'ops',
    name: 'Operations',
    color: '#f97316',
    createdAt: now,
    updatedAt: now
  });
  await scope.table('tasks').put({
    id: 'ops-1',
    title: 'Created with the category',
    categoryId: 'ops',
    completed: false,
    priority: 'high',
    createdAt: now,
    updatedAt: now
  });
  return 'ok';
});
return {
  outcome: tx.outcome,
  result: tx.result,
  categories: await client.table('categories').query(),
  tasks: await client.table('tasks').query()
};`
  },
  {
    id: 'change-events',
    title: { en: 'Change events', 'pt-BR': 'Eventos de mudanca' },
    description: {
      en: 'Subscribe and collect committed Task events.',
      'pt-BR': 'Assine e colete eventos confirmados de Task.'
    },
    code: `const client = cana.createClient({
  name: dbName,
  schema: ${schemaSource}
});
await client.open();
const seen = [];
const stop = client.subscribe((event) => {
  seen.push({ cursor: event.cursor, type: event.type, store: event.store, key: event.key });
});
await client.table('categories').add({ id: 'docs', name: 'Docs', color: '#0f766e' });
await client.table('tasks').add({
  id: 'docs-1',
  title: 'Listen to Cana events',
  categoryId: 'docs',
  completed: false,
  priority: 'medium',
  createdAt: 1,
  updatedAt: 1
});
await client.table('tasks').update('docs-1', { completed: true, updatedAt: 2 });
stop();
return { events: seen };`
  },
  {
    id: 'hooks',
    title: { en: 'Hooks', 'pt-BR': 'Hooks' },
    description: {
      en: 'Run beforeWrite and afterCommit hooks around Task writes.',
      'pt-BR': 'Rode hooks beforeWrite e afterCommit ao redor de escritas de Task.'
    },
    code: `const trail = [];
const client = cana.createClient({
  name: dbName,
  schema: ${schemaSource},
  hooks: {
    beforeWrite: (ctx) => { trail.push('before:' + ctx.store + ':' + ctx.type); },
    afterCommit: (events) => { trail.push('commit:' + events.length); }
  }
});
await client.open();
await client.table('categories').add({ id: 'docs', name: 'Docs', color: '#0f766e' });
await client.table('tasks').add({
  id: 'docs-1',
  title: 'Passes through hooks',
  categoryId: 'docs',
  completed: false,
  priority: 'medium',
  createdAt: 1,
  updatedAt: 1
});
return { trail, task: await client.table('tasks').get('docs-1') };`
  },
  {
    id: 'errors',
    title: { en: 'Errors', 'pt-BR': 'Erros' },
    description: {
      en: 'Detect duplicate Category ids with isCanaErrorCode.',
      'pt-BR': 'Detecte ids duplicados de Category com isCanaErrorCode.'
    },
    code: `const client = cana.createClient({
  name: dbName,
  schema: ${schemaSource}
});
await client.open();
await client.table('categories').add({ id: 'docs', name: 'Docs', color: '#0f766e' });
try {
  await client.table('categories').add({ id: 'docs', name: 'Duplicada', color: '#dc2626' });
  return { unexpected: 'no error' };
} catch (error) {
  return {
    isCanaError: cana.isCanaError(error),
    constraint: cana.isCanaErrorCode(error, 'ConstraintViolation'),
    code: error && error.code
  };
}`
  },
  {
    id: 'storage-durability',
    title: { en: 'Storage assessment', 'pt-BR': 'Avaliacao de storage' },
    description: {
      en: 'Read storageState and durabilityAssessment after writing Task data.',
      'pt-BR': 'Leia storageState e durabilityAssessment depois de gravar Task.'
    },
    code: `const client = cana.createClient({
  name: dbName,
  schema: ${schemaSource}
});
await client.open();
await client.table('categories').add({ id: 'docs', name: 'Docs', color: '#0f766e' });
await client.table('tasks').add({
  id: 'docs-1',
  title: 'Durable data',
  categoryId: 'docs',
  completed: false,
  priority: 'high',
  createdAt: 1,
  updatedAt: 1
});
const storage = await client.storageState();
const durability = await client.durabilityAssessment();
return { backend: client.backend, storage, durability };`
  },
  {
    id: 'crash-recovery',
    title: { en: 'Operation ledger', 'pt-BR': 'Operation ledger' },
    description: {
      en: 'Resolve a committed Task write with the operation ledger enabled.',
      'pt-BR': 'Resolva uma escrita de Task commitada com operation ledger ligado.'
    },
    code: `const client = cana.createClient({
  name: dbName,
  schema: ${schemaSource},
  operationLedger: true
});
await client.open();
const tx = await client.transaction('readwrite', ['categories', 'tasks'], async (scope) => {
  const now = Date.now();
  await scope.table('categories').put({ id: 'docs', name: 'Docs', color: '#0f766e' });
  await scope.table('tasks').put({
    id: 'docs-1',
    title: 'Reconcile uncertain write',
    categoryId: 'docs',
    completed: false,
    priority: 'high',
    createdAt: now,
    updatedAt: now
  });
  return 'wrote';
});
const resolved = await client.resolveWrite(tx.correlationId, tx.attemptedAt);
return { outcome: tx.outcome, resolved, task: await client.table('tasks').get('docs-1') };`
  },
  {
    id: 'export-import',
    title: { en: 'Export', 'pt-BR': 'Export' },
    description: {
      en: 'Export Category and Task stores as plain data.',
      'pt-BR': 'Exporte as stores Category e Task como dados puros.'
    },
    code: `const client = cana.createClient({
  name: dbName,
  schema: ${schemaSource}
});
await client.open();
${seedSource}
const dump = await client.exportAll();
return dump;`
  },
  {
    id: 'fallback-backend',
    title: { en: 'Backend selection', 'pt-BR': 'Selecao de backend' },
    description: {
      en: 'Show client.backend after opening the task database.',
      'pt-BR': 'Mostre client.backend apos abrir o banco de tasks.'
    },
    code: `const client = cana.createClient({
  name: dbName,
  schema: ${schemaSource},
  fallback: 'localStorage'
});
await client.open();
await client.table('categories').add({ id: 'docs', name: 'Docs', color: '#0f766e' });
return { backend: client.backend, categories: await client.table('categories').query() };`
  },
  {
    id: 'factory-adapter',
    title: { en: 'Factory adapter', 'pt-BR': 'Adapter de factory' },
    description: {
      en: 'Use createCanaDatabaseClient with Category and Task stores.',
      'pt-BR': 'Use createCanaDatabaseClient com stores Category e Task.'
    },
    code: `const adapter = cana.createCanaDatabaseClient({
  name: dbName,
  schema: ${schemaSource}
});
await adapter.connect();
await adapter.stores.categories.add({ id: 'docs', name: 'Docs', color: '#0f766e' });
await adapter.stores.tasks.add({
  id: 'docs-1',
  title: 'Created through the adapter',
  categoryId: 'docs',
  completed: false,
  priority: 'medium',
  createdAt: 1,
  updatedAt: 1
});
const task = await adapter.stores.tasks.get('docs-1');
await adapter.disconnect();
return {
  backend: adapter.cana.backend,
  stores: Object.keys(adapter.stores),
  task
};`
  },
  {
    id: 'worker-client-flow',
    title: { en: 'Worker client flow', 'pt-BR': 'Fluxo com worker client' },
    description: {
      en: 'Drive Cana through createWorkerHost, createRouter and createWorkerClient using MessageChannel.',
      'pt-BR': 'Use createWorkerHost, createRouter e createWorkerClient com MessageChannel.'
    },
    code: `const channel = new MessageChannel();
channel.port1.start?.();
channel.port2.start?.();

const broadcasts = [];
const router = cana.createRouter({
  port: channel.port1,
  timeoutMs: 5000,
  onBroadcast(event) {
    broadcasts.push({
      cursor: event.cursor,
      type: event.type,
      store: event.store,
      key: event.key
    });
  }
});

const host = cana.createWorkerHost({
  port: channel.port2,
  name: dbName,
  schema: ${schemaSource},
  originId: 'docs-worker-host',
  retainedEvents: 20,
  operationLedger: true
});

const workerClient = cana.createWorkerClient(router);

try {
  await workerClient.open();
  const now = Date.now();
  await workerClient.put('categories', {
    id: 'work',
    name: 'Work',
    color: '#2563eb',
    createdAt: now,
    updatedAt: now
  });
  await workerClient.add('tasks', {
    id: 'task-worker-1',
    title: 'Persist through the worker boundary',
    categoryId: 'work',
    completed: false,
    priority: 'medium',
    createdAt: now,
    updatedAt: now
  });
  const tasks = await workerClient.query('tasks', {
    index: 'byCategory',
    equals: 'work'
  });
  const count = await workerClient.count('tasks');
  return {
    ping: await workerClient.ping(),
    count,
    tasks,
    broadcasts
  };
} finally {
  await workerClient.close();
  router.dispose();
  await host.dispose();
  channel.port1.close();
  channel.port2.close();
}`
  },
  {
    id: 'spa-mvp-offline',
    title: { en: 'SPA MVP Day 1 — offline records in Cana', 'pt-BR': 'MVP SPA Dia 1 — registros offline no Cana' },
    description: {
      en: 'Open a real Cana IndexedDB client, seed Category, and create the first Task — the whole workflow runs in the browser.',
      'pt-BR': 'Abra um client Cana IndexedDB real, semeie Category e crie a primeira Task — o fluxo inteiro roda no browser.'
    },
    code: `const client = cana.createClient({
  name: dbName,
  schema: ${schemaSource}
});
await client.open();

const now = Date.now();
await client.table('categories').add({
  id: 'work',
  name: 'Work',
  color: '#2563eb',
  createdAt: now,
  updatedAt: now
});
await client.table('tasks').add({
  id: 'task-1',
  title: 'Offline task',
  categoryId: 'work',
  completed: false,
  priority: 'high',
  createdAt: now,
  updatedAt: now
});

return {
  backend: client.backend,
  category: await client.table('categories').get('work'),
  task: await client.table('tasks').get('task-1')
};`
  },
  {
    id: 'spa-mvp-events',
    title: { en: 'SPA MVP Day 2 — UI state from Cana events and indexed queries', 'pt-BR': 'MVP SPA Dia 2 — estado da UI via eventos do Cana e queries indexadas' },
    description: {
      en: 'Subscribe to committed change events, write and update a Task, then read it back through the byCategory index.',
      'pt-BR': 'Assine eventos de mudança confirmados, escreva e atualize uma Task, depois leia de volta pelo índice byCategory.'
    },
    code: `const client = cana.createClient({
  name: dbName,
  schema: ${schemaSource}
});
await client.open();

const seen = [];
const stop = client.subscribe((event) => {
  seen.push({ type: event.type, store: event.store, key: event.key });
});

const now = Date.now();
await client.table('categories').add({
  id: 'work',
  name: 'Work',
  color: '#2563eb',
  createdAt: now,
  updatedAt: now
});
await client.table('tasks').add({
  id: 'task-1',
  title: 'Listen to local changes',
  categoryId: 'work',
  completed: false,
  priority: 'medium',
  createdAt: now,
  updatedAt: now
});
await client.table('tasks').update('task-1', { completed: true, updatedAt: now + 1 });
stop();

const workTasks = await client.table('tasks').query({
  index: 'byCategory',
  equals: 'work'
});

return {
  events: seen,
  workTasks: workTasks.map((task) => ({ title: task.title, completed: task.completed }))
};`
  },
  {
    id: 'spa-mvp-durability',
    title: { en: 'SPA MVP Release — durability across reopen', 'pt-BR': 'MVP SPA Release — durabilidade ao reabrir' },
    description: {
      en: 'Close the client and reopen the same database: the offline records survive, proving durable local state.',
      'pt-BR': 'Feche o client e reabra o mesmo banco: os registros offline sobrevivem, provando estado local durável.'
    },
    code: `const client = cana.createClient({
  name: dbName,
  schema: ${schemaSource}
});
await client.open();

const now = Date.now();
await client.table('categories').add({
  id: 'work',
  name: 'Work',
  color: '#2563eb',
  createdAt: now,
  updatedAt: now
});
await client.table('tasks').add({
  id: 'task-1',
  title: 'Survives reload',
  categoryId: 'work',
  completed: false,
  priority: 'high',
  createdAt: now,
  updatedAt: now
});
await client.close();

const reopened = cana.createClient({
  name: dbName,
  schema: ${schemaSource}
});
await reopened.open();
const tasksAfterReopen = await reopened.table('tasks').query();
const categoriesAfterReopen = await reopened.table('categories').query();

return {
  backend: reopened.backend,
  categoriesAfterReopen: categoriesAfterReopen.length,
  tasksAfterReopen: tasksAfterReopen.map((task) => task.title)
};`
  }
];

export function getCanaSnippet(id: string): CanaSnippet | undefined {
  return CANA_SNIPPETS.find((snippet) => snippet.id === id);
}
