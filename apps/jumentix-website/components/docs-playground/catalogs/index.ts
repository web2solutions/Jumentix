import type { DocsRuntimeId, DocsSnippet } from '../types';
import { CANA_SNIPPETS } from '../../cana/snippets';

export const DESIGNER_CORE_SNIPPETS: readonly DocsSnippet[] = [
  {
    id: 'getting-started',
    title: { en: 'Validate a design', 'pt-BR': 'Validar um design' },
    description: {
      en: 'Normalize the sample model and collect validation issues (real designer-core API).',
      'pt-BR': 'Normalize o modelo de exemplo e colete issues de validação (API real do designer-core).'
    },
    // Must match @jumentix/designer-core public surface:
    // collectModelIssues(state) expects { domains, relationships } after
    // normalizeStatePayload — a fake { version, name, entities } shape throws.
    code: `const raw = api.buildSampleModelPayload();
const state = api.normalizeStatePayload(raw);
const issues = api.collectModelIssues(state);
const errors = issues.filter((issue) => issue.severity === 'error');
return {
  ok: errors.length === 0,
  issueCount: issues.length,
  errorCount: errors.length,
  sample: issues.slice(0, 3)
};`
  }
];

export const JUMENTIX_BROWSER_LAB_SNIPPETS: readonly DocsSnippet[] = [
  {
    id: 'getting-started',
    title: { en: 'Full Jumentix browser app', 'pt-BR': 'App Jumentix completo no browser' },
    description: {
      en: 'Run Category and Task through in-memory database, key/value, mutex, mediator, REST and WebSocket contracts without a server.',
      'pt-BR': 'Execute Category e Task com banco in-memory, chave/valor, mutex, mediator, REST e WebSocket sem servidor.'
    },
    code: `const database = api.createInMemoryDatabase({
  stores: ['categories', 'tasks']
});
const keyValue = api.createKeyValueStorage();
const mutex = api.createMutex(keyValue);
const mediator = api.createMessageMediator();
const emittedEvents = [];

await database.connect();
await keyValue.connect();

const model = api.createServiceModel({
  app: 'service-management',
  domain: 'Tasks'
});
const designReport = api.validateDesign(model);

await database.stores.categories.create('work', {
  id: 'work',
  name: 'Work',
  color: '#2563eb'
});
await database.stores.categories.create('home', {
  id: 'home',
  name: 'Home',
  color: '#16a34a'
});

await mediator.subscribe('tasks.created', async (event) => {
  emittedEvents.push({
    title: event.payload.title,
    categoryId: event.payload.categoryId
  });
});

mediator.registerHandler('tasks.create.v1', async (message) => {
  const task = {
    ...message.payload,
    completed: false,
    createdAt: Date.now()
  };
  const lock = await mutex.lock('category', task.categoryId);
  if (!lock.result.locked) {
    return { ok: false, error: 'category is busy' };
  }
  try {
    await database.stores.tasks.create(task.id, task);
    await keyValue.set(\`category:\${task.categoryId}:lastTask\`, task.id);
    await mediator.publish({ name: 'tasks.created', payload: task });
    return { ok: true, result: task };
  } finally {
    await mutex.unlock('category', task.categoryId);
  }
});

const restClient = api.createRestClient((request) => mediator.request({
  contract: 'tasks.create.v1',
  payload: request.body,
  metadata: { transport: 'rest' }
}));
const websocketClient = api.createWebSocketClient((request) => mediator.request({
  contract: 'tasks.create.v1',
  payload: request.input,
  metadata: { transport: 'websocket' }
}));

const firstTask = await restClient.request({
  operationId: 'createTask',
  method: 'POST',
  path: '/tasks',
  body: {
    id: 'task-1',
    title: 'Publish in-memory playgrounds',
    categoryId: 'work'
  }
});
await websocketClient.connect();
const secondTask = await websocketClient.request({
  operationId: 'tasks.create',
  input: {
    id: 'task-2',
    title: 'Review browser contract flow',
    categoryId: 'home'
  }
});
await websocketClient.disconnect();

const tasks = await database.stores.tasks.getAll({}, { page: 1, size: 10 });
const lastWorkTask = await keyValue.get('category:work:lastTask');

return {
  designOk: designReport.ok,
  taskCount: tasks.total,
  createdByRest: firstTask.result.title,
  createdByWebSocket: secondTask.result.title,
  lastWorkTask: lastWorkTask.result,
  emittedEvents
};`
  }
];

export const KV_SNIPPETS: readonly DocsSnippet[] = [
  {
    id: 'getting-started',
    title: { en: 'In-memory key/value', 'pt-BR': 'Chave/valor em memória' },
    description: {
      en: 'Cache UI preferences for the Task list with the same service-result shape used by package adapters.',
      'pt-BR': 'Guarde preferências da lista de Task com o mesmo formato de resposta usado pelos adaptadores do pacote.'
    },
    code: `const client = api.createInMemory();
await client.connect();

await client.set('ui:selected-category', {
  id: 'work',
  name: 'Work',
  visibleTaskIds: ['task-1', 'task-3']
});
await client.set('ui:last-sort', 'priority-desc');

const selectedCategory = await client.get('ui:selected-category');
const lastSort = await client.get('ui:last-sort');
await client.del('ui:last-sort');
const deletedSort = await client.get('ui:last-sort');
await client.disconnect();

return {
  selectedCategory: selectedCategory.result,
  lastSort: lastSort.result,
  deletedSort: deletedSort.result
};`
  }
];

export const MEDIATOR_SNIPPETS: readonly DocsSnippet[] = [
  {
    id: 'getting-started',
    title: { en: 'In-memory mediator', 'pt-BR': 'Mediator em memória' },
    description: {
      en: 'Create a Task through request/response and emit an event for UI listeners.',
      'pt-BR': 'Crie uma Task por request/response e emita um evento para listeners da UI.'
    },
    code: `const events = [];
const mediator = api.createInMemory();

await mediator.subscribe('tasks.created', async (event) => {
  events.push({
    title: event.payload.title,
    categoryId: event.payload.categoryId
  });
});

mediator.registerHandler('tasks.create.v1', async (message) => {
  const task = {
    id: message.payload.id,
    title: message.payload.title,
    categoryId: message.payload.categoryId,
    completed: false
  };
  await mediator.publish({ name: 'tasks.created', payload: task });
  return { ok: true, result: task };
});

const response = await mediator.request({
  contract: 'tasks.create.v1',
  payload: {
    id: 'task-1',
    title: 'Wire mediator events',
    categoryId: 'work'
  },
  metadata: { source: 'browser-playground' }
});

return {
  createdTask: response.result,
  events
};`
  }
];

export const MUTEX_SNIPPETS: readonly DocsSnippet[] = [
  {
    id: 'getting-started',
    title: { en: 'Mutex with in-memory KV', 'pt-BR': 'Mutex com KV em memória' },
    description: {
      en: 'Protect a Category update while two Task writers compete for the same resource.',
      'pt-BR': 'Proteja uma atualização de Category enquanto dois escritores de Task competem pelo mesmo recurso.'
    },
    code: `const keyValue = api.createKeyValueStorage();
const mutex = api.create(keyValue);

const firstWriter = await mutex.lock('category', 'work');
const secondWriter = await mutex.lock('category', 'work');
const lockedBeforeRelease = await mutex.isLocked('category', 'work');
await mutex.unlock('category', 'work');
const lockedAfterRelease = await mutex.isLocked('category', 'work');

return {
  firstWriter: firstWriter.result,
  secondWriter: secondWriter.result,
  lockedBeforeRelease: lockedBeforeRelease.result,
  lockedAfterRelease: lockedAfterRelease.result
};`
  }
];

export const REST_SDK_SNIPPETS: readonly DocsSnippet[] = [
  {
    id: 'getting-started',
    title: { en: 'REST client with mock fetch', 'pt-BR': 'Cliente REST com fetch mock' },
    description: {
      en: 'Call Task OpenAPI operations with a browser-safe mock client.',
      'pt-BR': 'Chame operações OpenAPI de Task com um cliente mock seguro para browser.'
    },
    code: `const client = api.createMockClient();

const created = await client.request({
  operationId: 'createTask',
  method: 'POST',
  path: '/tasks',
  body: {
    id: 'task-1',
    title: 'Generate REST SDK example',
    categoryId: 'work',
    completed: false
  }
});
const listed = await client.request({
  operationId: 'listTasks',
  method: 'GET',
  path: '/tasks?categoryId=work'
});

return {
  created,
  listed
};`
  }
];

export const WS_SDK_SNIPPETS: readonly DocsSnippet[] = [
  {
    id: 'getting-started',
    title: { en: 'WebSocket client with fake socket', 'pt-BR': 'Cliente WS com socket fake' },
    description: {
      en: 'Use the realtime client contract to create and list Task records in the browser.',
      'pt-BR': 'Use o contrato do cliente realtime para criar e listar registros Task no browser.'
    },
    code: `const client = api.createFakeClient();
const status = await client.connect();

const created = await client.request({
  operationId: 'tasks.create',
  input: {
    id: 'task-1',
    title: 'Render realtime updates',
    categoryId: 'home',
    completed: false
  }
});
const listed = await client.request({
  operationId: 'tasks.list',
  input: { categoryId: 'home' }
});
const closed = await client.disconnect();

return {
  status,
  created,
  listed,
  closed
};`
  }
];

const CATALOGS: Record<DocsRuntimeId, readonly DocsSnippet[]> = {
  cana: CANA_SNIPPETS,
  'designer-core': DESIGNER_CORE_SNIPPETS,
  'jumentix-browser-lab': JUMENTIX_BROWSER_LAB_SNIPPETS,
  'key-value-storage': KV_SNIPPETS,
  'message-mediator': MEDIATOR_SNIPPETS,
  'mutex-service': MUTEX_SNIPPETS,
  'sdk-rest-client': REST_SDK_SNIPPETS,
  'sdk-websocket-client': WS_SDK_SNIPPETS
};

export function getDocsSnippet(
  runtime: DocsRuntimeId,
  id: string
): DocsSnippet | undefined {
  return CATALOGS[runtime]?.find((snippet) => snippet.id === id);
}

export function listDocsSnippets(runtime: DocsRuntimeId): readonly DocsSnippet[] {
  return CATALOGS[runtime] ?? [];
}
