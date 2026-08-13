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
      en: 'Run Category and Task as separate domains that exchange messages through the mediator to compose a task board without a server.',
      'pt-BR': 'Execute Category e Task como domínios separados que trocam mensagens pelo mediator para compor um task board sem servidor.'
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

mediator.registerHandler('categories.get.v1', async (message) => {
  const category = await database.stores.categories.getOneById(message.payload.id);
  return {
    ok: Boolean(category.result),
    result: category.result,
    metadata: {
      domain: 'Categories',
      servedBy: 'categories.get.v1'
    }
  };
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

mediator.registerHandler('tasks.board.v1', async (message) => {
  const taskList = await database.stores.tasks.getAll(
    { completed: message.payload.completed },
    { page: 1, size: 20 }
  );
  const cards = await Promise.all(taskList.result.map(async (task) => {
    const category = await mediator.request({
      contract: 'categories.get.v1',
      payload: { id: task.categoryId },
      metadata: {
        sourceDomain: 'Tasks',
        reason: 'compose task board'
      }
    });
    return {
      id: task.id,
      title: task.title,
      completed: task.completed,
      category: category.result
        ? {
          id: category.result.id,
          name: category.result.name,
          color: category.result.color
        }
        : null
    };
  }));
  return {
    ok: true,
    result: {
      view: 'task-board',
      composedBy: ['Tasks', 'Categories'],
      cards
    }
  };
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
const taskBoard = await mediator.request({
  contract: 'tasks.board.v1',
  payload: { completed: false },
  metadata: { source: 'browser-playground' }
});

return {
  designOk: designReport.ok,
  taskCount: tasks.total,
  createdByRest: firstTask.result.title,
  createdByWebSocket: secondTask.result.title,
  lastWorkTask: lastWorkTask.result,
  composedDomains: taskBoard.result.composedBy,
  taskBoard: taskBoard.result.cards,
  emittedEvents
};`
  },
  {
    id: 'bulk-mutex-dead-letter',
    title: { en: 'Bulk writes with mutex + DLQ', 'pt-BR': 'Criação em massa com mutex + DLQ' },
    description: {
      en: 'Create many Task records for one Category, force lock contention, enqueue rejected controller requests in a dead-letter queue, then replay them through the controller workflow.',
      'pt-BR': 'Crie muitos registros Task para uma Category, force contenção de lock, envie requests rejeitados pelo controller para uma dead-letter queue e reprocesse tudo pelo fluxo do controller.'
    },
    code: `const database = api.createCanaDatabaseClient({
  name: api.createCanaDatabaseName('bulk-mutex-dlq'),
  schema: {
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
          { name: 'byUpdatedAt', keyPath: 'updatedAt' },
          { name: 'bySource', keyPath: 'source' }
        ]
      }
    ]
  }
});
const keyValue = api.createKeyValueStorage();
const mutex = api.createMutex(keyValue);
const mediator = api.createMessageMediator();
const deadLetterQueue = api.createDeadLetterQueue({ maxAttempts: 3 });
const replayInbox = [];
const timeline = [];
const canaEvents = [];
const React = api.React;
const BulkTaskImportContext = React.createContext(null);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const stopCanaEvents = database.subscribe((event) => {
  canaEvents.push({
    cursor: event.cursor,
    type: event.type,
    store: event.store,
    key: event.key,
    taskId: event.store === 'tasks' ? event.record.id : undefined,
    categoryId: event.record && event.record.categoryId ? event.record.categoryId : event.key,
    source: event.record && event.record.source ? event.record.source : 'category-seed'
  });
});

function createBulkTaskImportProvider({ actorId }) {
  const state = {
    actorId,
    submittedBatches: 0,
    lastBatchSize: 0
  };
  const contextValue = {
    actorId,
    getState: () => ({ ...state }),
    submitBulkImport: async (tasks) => {
      state.submittedBatches += 1;
      state.lastBatchSize = tasks.length;
      timeline.push({
        step: 'react-context-submit',
        component: 'BulkTaskImportProvider',
        actorId,
        taskCount: tasks.length
      });
      const responses = await bulkImportController({
        body: { tasks },
        actorId,
        client: 'react-context-api',
        stopNewRequestsAfterMs: 26
      });
      state.accepted = responses.filter((response) => response.ok).length;
      state.rejected = responses.filter((response) => response.deadLetterId).length;
      state.interrupted = responses.filter((response) => response.interrupted).length;
      timeline.push({
        step: 'react-context-complete',
        component: 'BulkTaskImportProvider',
        accepted: state.accepted,
        rejected: state.rejected,
        interrupted: state.interrupted
      });
      return responses;
    }
  };
  return {
    Context: BulkTaskImportContext,
    value: contextValue
  };
}

function BulkImportPanel({ provider, tasks }) {
  const previewTree = React.createElement(
    provider.Context.Provider,
    { value: provider.value },
    'BulkImportButton'
  );
  return {
    component: 'BulkImportPanel',
    previewElementType: previewTree.type === provider.Context.Provider
      ? 'BulkTaskImportContext.Provider'
      : 'unknown',
    clickRun: async () => {
      timeline.push({
        step: 'react-component-click',
        component: 'BulkImportPanel',
        taskCount: tasks.length
      });
      const responses = await provider.value.submitBulkImport(tasks);
      timeline.push({
        step: 'react-component-render',
        component: 'BulkImportPanel',
        state: provider.value.getState()
      });
      return responses;
    }
  };
}

await database.connect();
await keyValue.connect();

await database.stores.categories.add({
  id: 'work',
  name: 'Work',
  color: '#2563eb',
  createdAt: Date.now(),
  updatedAt: Date.now()
});

await mediator.subscribe('dead-letter.enqueued', async (event) => {
  replayInbox.push(event.payload.recordId);
  timeline.push({
    step: 'dead-letter-listener-received',
    taskId: event.payload.taskId,
    recordId: event.payload.recordId
  });
});

await mediator.subscribe('tasks.created', async (event) => {
  timeline.push({
    step: 'task-created-event',
    taskId: event.payload.id,
    source: event.payload.source
  });
});

async function createTaskUseCase(input) {
  const lock = await mutex.lock('category', input.categoryId);
  if (!lock.result.locked) {
    const record = await deadLetterQueue.enqueue({
      entityName: 'Task',
      resourceId: input.categoryId,
      operation: 'tasks.create.v1',
      payload: input,
      actorId: input.requestedBy
    });
    await mediator.publish({
      name: 'dead-letter.enqueued',
      payload: {
        recordId: record.id,
        taskId: input.id,
        categoryId: input.categoryId
      },
      metadata: {
        source: 'tasks.create.use-case',
        reason: 'category resource is already locked'
      }
    });
    return {
      ok: false,
      status: 409,
      error: 'category is locked; request queued for replay',
      deadLetterId: record.id
    };
  }

  try {
    timeline.push({
      step: 'lock-acquired',
      taskId: input.id,
      categoryId: input.categoryId
    });
    await sleep(input.processingMs);
    const task = {
      id: input.id,
      title: input.title,
      categoryId: input.categoryId,
      completed: false,
      source: input.source,
      createdAt: new Date().toISOString(),
      updatedAt: Date.now()
    };
    const write = await database.stores.tasks.add(task);
    timeline.push({
      step: 'cana-task-written',
      taskId: task.id,
      categoryId: task.categoryId,
      source: task.source,
      emittedEvents: write.events.length
    });
    await keyValue.set(\`category:\${task.categoryId}:lastTask\`, task.id);
    await mediator.publish({ name: 'tasks.created', payload: task });
    return { ok: true, status: 201, result: task };
  } finally {
    await mutex.unlock('category', input.categoryId);
    timeline.push({
      step: 'lock-released',
      taskId: input.id,
      categoryId: input.categoryId
    });
  }
}

async function createTaskController(request) {
  timeline.push({
    step: request.replay ? 'controller-replay' : 'controller-create',
    taskId: request.body.id
  });
  return createTaskUseCase({
    ...request.body,
    requestedBy: request.actorId,
    source: request.replay ? 'dead-letter-replay' : 'bulk-import'
  });
}

async function bulkImportController(request) {
  const startedAt = Date.now();
  let stopRecorded = false;
  timeline.push({
    step: 'bulk-import-controller',
    component: 'BulkImportController',
    actorId: request.actorId,
    client: request.client,
    taskCount: request.body.tasks.length,
    stopNewRequestsAfterMs: request.stopNewRequestsAfterMs
  });
  return Promise.all(request.body.tasks.map(async (task) => {
    await sleep(task.clientDelayMs);
    const elapsedMs = Date.now() - startedAt;
    if (elapsedMs > request.stopNewRequestsAfterMs) {
      if (!stopRecorded) {
        stopRecorded = true;
        timeline.push({
          step: 'client-ingestion-stopped',
          component: 'BulkImportController',
          elapsedMs,
          reason: 'stop accepting new client requests'
        });
      }
      timeline.push({
        step: 'client-request-interrupted',
        component: 'BulkImportController',
        taskId: task.id,
        elapsedMs
      });
      return {
        ok: false,
        status: 202,
        interrupted: true,
        error: 'client stopped sending new requests before controller admission',
        taskId: task.id
      };
    }
    return createTaskController({
      body: task,
      actorId: request.actorId
    });
  }));
}

const deadLetterHandlers = {
  'tasks.create.v1': async (record) => {
    const response = await createTaskController({
      body: {
        ...record.payload,
        processingMs: 1
      },
      actorId: 'dlq-replay-controller',
      replay: true
    });
    if (!response.ok) throw new Error(response.error ?? 'replay failed');
  }
};

async function replayDeadLettersController() {
  const pendingBefore = await deadLetterQueue.pending();
  const report = await deadLetterQueue.replay(deadLetterHandlers);
  const records = await deadLetterQueue.list();
  return {
    ok: true,
    status: 200,
    pendingBefore: pendingBefore.length,
    report,
    records: records.map((record) => ({
      id: record.id,
      taskId: record.payload.id,
      status: record.status,
      attempts: record.attempts
    }))
  };
}

const bulkTasks = Array.from({ length: 8 }, (_, index) => ({
  id: \`task-\${index + 1}\`,
  title: \`Bulk imported Task \${index + 1}\`,
  categoryId: 'work',
  processingMs: index === 0 ? 45 : 5,
  clientDelayMs: index * 6
}));

const provider = createBulkTaskImportProvider({ actorId: 'bulk-import-controller' });
const bulkImportPanel = BulkImportPanel({ provider, tasks: bulkTasks });
const bulkResponses = await bulkImportPanel.clickRun();
const pendingAfterBulk = await deadLetterQueue.pending();
const replay = await replayDeadLettersController();
const pendingAfterReplay = await deadLetterQueue.pending();
const taskRows = await database.stores.tasks.query({ index: 'byUpdatedAt' });
const categoryRows = await database.stores.categories.query({ index: 'byName' });
const lastTask = await keyValue.get('category:work:lastTask');
const storage = await database.cana.storageState();
const databaseSnapshot = {
  adapter: 'Cana database adapter',
  backend: database.cana.backend,
  storage,
  indexedDbDatabase: database.cana.name,
  stores: {
    categories: categoryRows.length,
    tasks: taskRows.length
  },
  categoryIds: categoryRows.map((category) => category.id),
  taskIds: taskRows.map((task) => task.id)
};

stopCanaEvents();
await database.disconnect();

const createdDuringBulk = bulkResponses.filter((response) => response.ok).length;
const submittedToController = bulkResponses.filter((response) => !response.interrupted).length;
const interruptedBeforeController = bulkResponses.filter((response) => response.interrupted).length;
const rejectedToDeadLetterQueue = bulkResponses.filter((response) => response.deadLetterId).length;
const deadLetterQueueFullyProcessed = pendingAfterReplay.length === 0
  && replay.records.every((record) => record.status === 'succeeded');
const jobsAccountedFor = taskRows.length + interruptedBeforeController;

return {
  databaseAdapter: 'Cana',
  databaseBackend: databaseSnapshot.backend,
  attemptedBulkCount: bulkTasks.length,
  createdDuringBulk,
  submittedToController,
  interruptedBeforeController,
  rejectedToDeadLetterQueue,
  shutdownReport: {
    stopNewRequestsAfterMs: 26,
    pendingDeadLettersAfterReplay: pendingAfterReplay.length,
    deadLetterQueueFullyProcessed,
    jobsAccountedFor,
    noLostJobs: deadLetterQueueFullyProcessed && jobsAccountedFor === bulkTasks.length
  },
  pendingBeforeReplay: pendingAfterBulk.map((record) => ({
    id: record.id,
    taskId: record.payload.id,
    resourceId: record.resourceId,
    status: record.status
  })),
  replayInbox,
  replayReport: replay.report,
  finalTaskCount: taskRows.length,
  lastTaskInCategory: lastTask.result,
  requestTimeline: timeline,
  canaEvents,
  databaseSnapshot,
  controllerLevelReplay: timeline
    .filter((entry) => entry.step.startsWith('controller'))
    .map((entry) => entry.step),
  storedTasks: taskRows.map((task) => ({
    id: task.id,
    title: task.title,
    source: task.source
  })),
  deadLetterRecords: replay.records
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
      en: 'Exchange messages between Category and Task domains, then compose a read model through mediator request/response.',
      'pt-BR': 'Troque mensagens entre os domínios Category e Task e componha um read model via request/response do mediator.'
    },
    code: `const domainMessages = [];
const events = [];
const mediator = api.createInMemory();

const categories = new Map([
  ['work', { id: 'work', name: 'Work', color: '#2563eb' }],
  ['home', { id: 'home', name: 'Home', color: '#16a34a' }]
]);
const tasks = [];

await mediator.subscribe('tasks.created', async (event) => {
  events.push({
    title: event.payload.title,
    categoryId: event.payload.categoryId
  });
});

mediator.registerHandler('categories.get.v1', async (message) => {
  domainMessages.push({
    from: message.metadata.sourceDomain,
    to: 'Categories',
    contract: 'categories.get.v1',
    categoryId: message.payload.id
  });
  return {
    ok: true,
    result: categories.get(message.payload.id) ?? null
  };
});

mediator.registerHandler('tasks.create.v1', async (message) => {
  const task = {
    id: message.payload.id,
    title: message.payload.title,
    categoryId: message.payload.categoryId,
    completed: false
  };
  tasks.push(task);
  await mediator.publish({ name: 'tasks.created', payload: task });
  return { ok: true, result: task };
});

mediator.registerHandler('tasks.board.v1', async () => {
  const cards = await Promise.all(tasks.map(async (task) => {
    const category = await mediator.request({
      contract: 'categories.get.v1',
      payload: { id: task.categoryId },
      metadata: {
        sourceDomain: 'Tasks',
        reason: 'compose task board read model'
      }
    });
    return {
      id: task.id,
      title: task.title,
      categoryName: category.result?.name ?? 'Uncategorized',
      categoryColor: category.result?.color ?? '#64748b'
    };
  }));
  return {
    ok: true,
    result: {
      readModel: 'TaskBoard',
      composedFrom: ['Tasks', 'Categories'],
      cards
    }
  };
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
const board = await mediator.request({
  contract: 'tasks.board.v1',
  payload: {},
  metadata: { source: 'task-board-page' }
});

return {
  createdTask: response.result,
  board: board.result,
  domainMessages,
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
