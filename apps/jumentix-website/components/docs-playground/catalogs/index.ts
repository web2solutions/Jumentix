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
    code: `const taskSchema = {
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
        { name: 'bySource', keyPath: 'source' },
        { name: 'byClient', keyPath: 'clientId' },
        { name: 'byWorker', keyPath: 'workerId' }
      ]
    }
  ]
};
const database = api.createCanaDatabaseClient({
  name: api.createCanaDatabaseName('bulk-mutex-dlq-workers'),
  schema: taskSchema,
  operationLedger: true
});
const keyValue = api.createKeyValueStorage();
const mutex = api.createMutex(keyValue);
const mediator = api.createMessageMediator();
const deadLetterQueue = api.createDeadLetterQueue({ maxAttempts: 3 });
const replayInbox = [];
const timeline = [];
let totalTimelineEvents = 0;
const canaEvents = [];
const storageUsageSamples = [];
const workerShards = [];
const React = api.React;
const BulkTaskImportContext = React.createContext(null);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const realtimeMetrics = {
  attempted: 0,
  processed: 0,
  rejected: 0,
  replayed: 0
};
const criticalTimelineSteps = new Set([
  'client-ingestion-stopped',
  'controller-replay-batch',
  'controller-replay',
  'react-component-render'
]);
function publishRealtimeMetrics(phase) {
  if (typeof reportPlaygroundProgress === 'function') {
    reportPlaygroundProgress({
      ...realtimeMetrics,
      phase,
      timestamp: Date.now()
    });
  }
}
function recordTimeline(entry) {
  totalTimelineEvents += 1;
  if (timeline.length < 320) {
    timeline.push(entry);
  } else if (criticalTimelineSteps.has(entry.step)) {
    timeline.shift();
    timeline.push(entry);
  }
}
async function recordIndexedDbQuota(label, tasks = 0) {
  const estimate = navigator.storage && navigator.storage.estimate
    ? await navigator.storage.estimate()
    : {};
  const usage = Number(estimate.usage ?? 0);
  const quota = Number(estimate.quota ?? 0);
  const percent = quota > 0 ? (usage / quota) * 100 : 0;
  storageUsageSamples.push({ label, usage, quota, percent, tasks });
  return storageUsageSamples[storageUsageSamples.length - 1];
}
const stopCanaEvents = database.subscribe((event) => {
  canaEvents.push({
    cursor: event.cursor,
    type: event.type,
    store: event.store,
    key: event.key,
    taskId: event.store === 'tasks' && event.record ? event.record.id : undefined,
    categoryId: event.record && event.record.categoryId ? event.record.categoryId : event.key,
    clientId: event.record && event.record.clientId ? event.record.clientId : undefined,
    workerId: event.record && event.record.workerId ? event.record.workerId : undefined,
    source: event.record && event.record.source ? event.record.source : 'category-seed'
  });
});

function createCanaWorkerShard(id) {
  const channel = new MessageChannel();
  channel.port1.start?.();
  channel.port2.start?.();
  const shard = {
    id,
    status: 'starting',
    handledRequests: 0,
    events: 0,
    database: database.cana.name,
    channel,
    router: null,
    host: null,
    client: null
  };
  shard.router = api.createCanaRouter({
    port: channel.port1,
    timeoutMs: 5000,
    onBroadcast(event) {
      shard.events += 1;
      canaEvents.push({
        cursor: event.cursor,
        type: event.type,
        store: event.store,
        key: event.key,
        taskId: event.store === 'tasks' && event.record ? event.record.id : undefined,
        categoryId: event.record && event.record.categoryId ? event.record.categoryId : event.key,
        clientId: event.record && event.record.clientId ? event.record.clientId : undefined,
        workerId: id,
        source: event.record && event.record.source ? event.record.source : 'worker-broadcast'
      });
    }
  });
  shard.host = api.createCanaWorkerHost({
    port: channel.port2,
    name: database.cana.name,
    schema: taskSchema,
    originId: \`docs-\${id}\`,
    retainedEvents: 50,
    operationLedger: true
  });
  shard.client = api.createCanaWorkerClient(shard.router);
  return shard;
}

function closeWorkerShard(shard) {
  return Promise.resolve()
    .then(() => shard.client.close())
    .catch(() => undefined)
    .then(() => {
      shard.router.dispose();
      shard.channel.port1.close();
      shard.channel.port2.close();
      return shard.host.dispose();
    });
}

function createBulkTaskImportProvider({ actorId, clientId }) {
  const state = {
    actorId,
    clientId,
    submittedBatches: 0,
    lastBatchSize: 0
  };
  const contextValue = {
    actorId,
    clientId,
    getState: () => ({ ...state }),
    submitBulkImport: async (tasks, options = {}) => {
      state.submittedBatches += 1;
      state.lastBatchSize = tasks.length;
      recordTimeline({
        step: 'react-context-submit',
        component: 'BulkTaskImportProvider',
        actorId,
        clientId,
        taskCount: tasks.length
      });
      const responses = await bulkImportController({
        body: { tasks },
        actorId,
        client: clientId,
        stopNewRequestsAfterMs: options.stopNewRequestsAfterMs ?? Number.POSITIVE_INFINITY
      });
      state.accepted = (state.accepted ?? 0) + responses.filter((response) => response.ok).length;
      state.rejected = (state.rejected ?? 0) + responses.filter((response) => response.deadLetterId).length;
      state.interrupted = (state.interrupted ?? 0) + responses.filter((response) => response.interrupted).length;
      recordTimeline({
        step: 'react-context-complete',
        component: 'BulkTaskImportProvider',
        clientId,
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

function BulkImportPanel({ provider, createNextTask, streamConfig }) {
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
    startStream: async () => {
      recordTimeline({
        step: 'react-component-click',
        component: 'BulkImportPanel',
        clientId: provider.value.clientId,
        mode: 'concurrent-30s-stream',
        durationMs: streamConfig.durationMs,
        maxConcurrentRequests: streamConfig.maxConcurrentRequests
      });
      const responses = [];
      let stopped = false;
      let inFlight = 0;
      const startedAt = Date.now();

      await new Promise((resolve) => {
        const launchNext = () => {
          if (Date.now() - startedAt >= streamConfig.durationMs) {
            if (!stopped) {
              stopped = true;
              recordTimeline({
                step: 'client-ingestion-stopped',
                component: 'BulkImportPanel',
                clientId: provider.value.clientId,
                elapsedMs: Date.now() - startedAt,
                reason: '30 second stream window completed'
              });
            }
            if (inFlight === 0) resolve();
            return;
          }

          while (inFlight < streamConfig.maxConcurrentRequests && Date.now() - startedAt < streamConfig.durationMs) {
            const task = createNextTask(provider.value.clientId);
            inFlight += 1;
            provider.value.submitBulkImport([task])
              .then((batchResponses) => {
                responses.push(...batchResponses);
              })
              .finally(() => {
                inFlight -= 1;
                launchNext();
              });
          }
        };
        launchNext();
      });

      recordTimeline({
        step: 'react-component-render',
        component: 'BulkImportPanel',
        clientId: provider.value.clientId,
        state: provider.value.getState()
      });
      return responses;
    }
  };
}

await database.connect();
await keyValue.connect();
workerShards.push(
  createCanaWorkerShard('worker-a'),
  createCanaWorkerShard('worker-b'),
  createCanaWorkerShard('worker-c')
);
await Promise.all(workerShards.map(async (shard) => {
  await shard.client.open();
  shard.status = 'ready';
}));
await recordIndexedDbQuota('opened', 0);

await database.stores.categories.add({
  id: 'work',
  name: 'Work',
  color: '#2563eb',
  createdAt: Date.now(),
  updatedAt: Date.now()
});
await recordIndexedDbQuota('category seeded', 0);

await mediator.subscribe('dead-letter.enqueued', async (event) => {
  replayInbox.push(event.payload.recordId);
  recordTimeline({
    step: 'dead-letter-listener-received',
    taskId: event.payload.taskId,
    recordId: event.payload.recordId
  });
});

await mediator.subscribe('tasks.created', async (event) => {
  recordTimeline({
    step: 'task-created-event',
    taskId: event.payload.id,
    source: event.payload.source
  });
});

let committedTaskCount = 0;

async function recordWriteQuota(taskId) {
  committedTaskCount += 1;
  if (committedTaskCount <= 3 || committedTaskCount % 500 === 0) {
    await recordIndexedDbQuota(\`\${taskId}: \${committedTaskCount} tasks\`, committedTaskCount);
  }
}

function createTaskRecord(input, source) {
  return {
    id: input.id,
    title: input.title,
    categoryId: input.categoryId,
    completed: false,
    clientId: input.clientId,
    workerId: input.workerId,
    source,
    createdAt: new Date().toISOString(),
    updatedAt: Date.now()
  };
}

async function writeTasksWithCanaWorkers(tasks, source) {
  const groups = new Map();
  for (const task of tasks) {
    const selectedWorker = workerShards.find((shard) => shard.id === task.workerId)
      ?? workerShards[groups.size % workerShards.length];
    const record = {
      ...task,
      workerId: selectedWorker.id,
      source
    };
    const current = groups.get(selectedWorker) ?? [];
    current.push(record);
    groups.set(selectedWorker, current);
  }

  const reports = [];
  for (const [worker, records] of groups.entries()) {
    worker.status = records.length > 1 ? 'bulk-writing' : 'writing';
    const write = records.length === 1
      ? await worker.client.add('tasks', records[0])
      : await worker.client.bulkAdd('tasks', records);
    worker.handledRequests += records.length;
    worker.status = 'ready';
    for (const task of records) {
      await recordWriteQuota(task.id);
    }
    const lastTask = records[records.length - 1];
    await keyValue.set(\`category:\${lastTask.categoryId}:lastTask\`, lastTask.id);
    reports.push({
      workerId: worker.id,
      count: records.length,
      emittedEvents: write.events ? write.events.length : records.length
    });
  }
  return reports;
}

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
    realtimeMetrics.rejected += 1;
    publishRealtimeMetrics('rejected');
    return {
      ok: false,
      status: 409,
      error: 'category is locked; request queued for replay',
      deadLetterId: record.id
    };
  }

  try {
    recordTimeline({
      step: 'lock-acquired',
      taskId: input.id,
      categoryId: input.categoryId
    });
    await sleep(input.processingMs);
    const task = createTaskRecord(input, input.source);
    const [write] = await writeTasksWithCanaWorkers([task], input.source);
    recordTimeline({
      step: 'cana-task-written',
      taskId: task.id,
      categoryId: task.categoryId,
      clientId: task.clientId,
      workerId: write.workerId,
      source: task.source,
      emittedEvents: write.emittedEvents
    });
    await mediator.publish({ name: 'tasks.created', payload: task });
    realtimeMetrics.processed += 1;
    publishRealtimeMetrics('processed');
    return { ok: true, status: 201, result: task };
  } finally {
    await mutex.unlock('category', input.categoryId);
    recordTimeline({
      step: 'lock-released',
      taskId: input.id,
      categoryId: input.categoryId
    });
  }
}

async function createTaskController(request) {
  if (!request.replay) {
    realtimeMetrics.attempted += 1;
    publishRealtimeMetrics('submitted');
  }
  recordTimeline({
    step: request.replay ? 'controller-replay' : 'controller-create',
    taskId: request.body.id,
    clientId: request.body.clientId,
    workerId: request.body.workerId
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
  recordTimeline({
    step: 'bulk-import-controller',
    component: 'BulkImportController',
    actorId: request.actorId,
    client: request.client,
    clientId: request.client,
    taskCount: request.body.tasks.length,
    stopNewRequestsAfterMs: request.stopNewRequestsAfterMs
  });
  return Promise.all(request.body.tasks.map(async (task) => {
    if (task.clientDelayMs > 0) {
      await sleep(task.clientDelayMs);
    }
    const elapsedMs = Date.now() - startedAt;
    if (elapsedMs > request.stopNewRequestsAfterMs) {
      if (!stopRecorded) {
        stopRecorded = true;
        recordTimeline({
          step: 'client-ingestion-stopped',
          component: 'BulkImportController',
          clientId: request.client,
          elapsedMs,
          reason: 'stop accepting new client requests'
        });
      }
      recordTimeline({
        step: 'client-request-interrupted',
        component: 'BulkImportController',
        taskId: task.id,
        clientId: request.client,
        workerId: task.workerId,
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

async function replayDeadLettersController() {
  const pendingBefore = await deadLetterQueue.pending();
  const replayableRecords = pendingBefore.filter((record) => record.operation === 'tasks.create.v1');
  const skippedRecords = pendingBefore.filter((record) => record.operation !== 'tasks.create.v1');
  recordTimeline({
    step: 'controller-replay-batch',
    component: 'ReplayDeadLettersController',
    taskCount: replayableRecords.length,
    mode: 'worker-bulk-add'
  });
  const replayTasks = replayableRecords.map((record) => createTaskRecord(
    {
      ...record.payload,
      processingMs: 0
    },
    'dead-letter-replay'
  ));
  const bulkReports = await writeTasksWithCanaWorkers(replayTasks, 'dead-letter-replay');
  await Promise.all(replayableRecords.map((record) => deadLetterQueue.settle(record.id, 'succeeded')));
  realtimeMetrics.replayed += replayableRecords.length;
  publishRealtimeMetrics('replayed');
  replayableRecords.slice(0, 80).forEach((record) => {
    recordTimeline({
      step: 'controller-replay',
      taskId: record.payload.id,
      clientId: record.payload.clientId,
      workerId: record.payload.workerId
    });
  });
  const report = {
    replayed: replayableRecords.map((record) => record.id),
    retried: [],
    abandoned: [],
    skipped: skippedRecords.map((record) => record.id)
  };
  const records = await deadLetterQueue.list();
  return {
    ok: true,
    status: 200,
    pendingBefore: pendingBefore.length,
    report,
    bulkReports,
    records: records.map((record) => ({
      id: record.id,
      taskId: record.payload.id,
      status: record.status,
      attempts: record.attempts
    }))
  };
}

const reactClientIds = ['react-client-a', 'react-client-b', 'react-client-c'];
const streamDurationMs = 30000;
const maxConcurrentRequestsPerClient = 12;
const requestPaceMs = 25;
let globalSequence = 0;
function createNextTask(clientId) {
  const sequence = globalSequence;
  globalSequence += 1;
  return {
    id: \`task-\${sequence + 1}\`,
    title: \`Concurrent Task \${sequence + 1}\`,
    categoryId: 'work',
    clientId,
    workerId: workerShards[sequence % workerShards.length].id,
    sequence,
    processingMs: 12,
    clientDelayMs: requestPaceMs
  };
}

const reactClients = reactClientIds.map((clientId) => {
  const provider = createBulkTaskImportProvider({
    actorId: \`\${clientId}-controller\`,
    clientId
  });
  return {
    id: clientId,
    provider,
    panel: BulkImportPanel({
      provider,
      createNextTask,
      streamConfig: {
        durationMs: streamDurationMs,
        maxConcurrentRequests: maxConcurrentRequestsPerClient
      }
    })
  };
});
const streamStartedAt = Date.now();
const bulkResponseGroups = await Promise.all(
  reactClients.map((client) => client.panel.startStream())
);
const actualRunDurationMs = Date.now() - streamStartedAt;
const bulkResponses = bulkResponseGroups.flat();
const pendingAfterBulk = await deadLetterQueue.pending();
const replay = await replayDeadLettersController();
const pendingAfterReplay = await deadLetterQueue.pending();
const taskRows = await database.stores.tasks.query({ index: 'byUpdatedAt' });
const categoryRows = await database.stores.categories.query({ index: 'byName' });
const lastTask = await keyValue.get('category:work:lastTask');
await recordIndexedDbQuota('final', taskRows.length);
const storage = await database.cana.storageState();
const workerShardSummary = workerShards.map((shard) => ({
  id: shard.id,
  database: shard.database,
  status: shard.status,
  handledRequests: shard.handledRequests,
  events: shard.events
}));
const databaseSnapshot = {
  adapter: 'Cana database adapter',
  backend: database.cana.backend,
  workerMode: 'createWorkerHost + createWorkerClient',
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
await Promise.all(workerShards.map(closeWorkerShard));
await database.disconnect();

const createdDuringBulk = bulkResponses.filter((response) => response.ok).length;
const submittedToController = bulkResponses.filter((response) => !response.interrupted).length;
const interruptedBeforeController = bulkResponses.filter((response) => response.interrupted).length;
const rejectedToDeadLetterQueue = bulkResponses.filter((response) => response.deadLetterId).length;
const deadLetterQueueFullyProcessed = pendingAfterReplay.length === 0
  && replay.records.every((record) => record.status === 'succeeded');
const jobsAccountedFor = taskRows.length + interruptedBeforeController;
publishRealtimeMetrics('complete');

return {
  databaseAdapter: 'Cana',
  databaseBackend: databaseSnapshot.backend,
  requestMode: 'concurrent-30s-stream',
  streamDurationMs,
  actualRunDurationMs,
  maxConcurrentRequestsPerClient,
  requestPaceMs,
  attemptedBulkCount: bulkResponses.length,
  createdDuringBulk,
  submittedToController,
  interruptedBeforeController,
  rejectedToDeadLetterQueue,
  shutdownReport: {
    stopNewRequestsAfterMs: streamDurationMs,
    pendingDeadLettersAfterReplay: pendingAfterReplay.length,
    deadLetterQueueFullyProcessed,
    jobsAccountedFor,
    noLostJobs: deadLetterQueueFullyProcessed && jobsAccountedFor === bulkResponses.length
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
  reactClients: reactClients.map((client) => ({
    id: client.id,
    taskCount: client.provider.value.getState().accepted
      + client.provider.value.getState().rejected
      + client.provider.value.getState().interrupted,
    accepted: client.provider.value.getState().accepted,
    rejected: client.provider.value.getState().rejected,
    interrupted: client.provider.value.getState().interrupted
  })),
  workerShards: workerShardSummary,
  requestTimeline: timeline,
  totalTimelineEvents,
  canaEvents: canaEvents.slice(-500),
  totalCanaEvents: canaEvents.length,
  storageUsageSamples,
  databaseSnapshot,
  controllerLevelReplay: timeline
    .filter((entry) => entry.step.startsWith('controller'))
    .slice(0, 40)
    .map((entry) => entry.step),
  storedTasks: taskRows.slice(0, 20).map((task) => ({
    id: task.id,
    title: task.title,
    source: task.source,
    clientId: task.clientId,
    workerId: task.workerId
  })),
  omittedStoredTasks: Math.max(0, taskRows.length - 20),
  deadLetterRecords: replay.records
};`
  },
  {
    id: 'rest-mvp-use-case',
    title: { en: 'REST MVP Day 1 — use-case on the in-memory adapter', 'pt-BR': 'MVP REST Dia 1 — use-case no adaptador in-memory' },
    description: {
      en: 'Run the create task use-case against the real in-memory database adapter and prove the 201/400/404 rules.',
      'pt-BR': 'Execute o use-case de criar task contra o adaptador real in-memory e prove as regras 201/400/404.'
    },
    code: `const database = api.createInMemoryDatabase({ stores: ['categories', 'tasks'] });
await database.connect();
await database.stores.categories.create('work', { id: 'work', name: 'Work' });

async function createTaskUseCase(input) {
  if (!input.title || !String(input.title).trim()) {
    return { status: 400, body: { error: 'title is required' } };
  }
  const category = await database.stores.categories.getOneById(input.categoryId);
  if (!category.result) {
    return { status: 404, body: { error: 'category not found' } };
  }
  const task = {
    id: crypto.randomUUID(),
    title: input.title,
    categoryId: input.categoryId,
    completed: false
  };
  await database.stores.tasks.create(task.id, task);
  return { status: 201, body: task };
}

const created = await createTaskUseCase({ title: 'Ship the MVP', categoryId: 'work' });
const invalid = await createTaskUseCase({ title: ' ', categoryId: 'work' });
const orphan = await createTaskUseCase({ title: 'No owner', categoryId: 'missing' });
const listed = await database.stores.tasks.getAll({}, { page: 1, size: 10 });

return {
  created: created.status,
  invalid: invalid.status,
  unknownCategory: orphan.status,
  storedTotal: listed.total,
  firstTask: listed.result[0].title
};`
  },
  {
    id: 'rest-mvp-client',
    title: { en: 'REST MVP Day 2 — typed client over the same adapter', 'pt-BR': 'MVP REST Dia 2 — client tipado sobre o mesmo adaptador' },
    description: {
      en: 'Route OpenAPI operationIds through a REST client into a handler backed by the in-memory adapter.',
      'pt-BR': 'Roteie operationIds OpenAPI por um client REST para um handler apoiado no adaptador in-memory.'
    },
    code: `const database = api.createInMemoryDatabase({ stores: ['categories', 'tasks'] });
await database.connect();
await database.stores.categories.create('work', { id: 'work', name: 'Work' });

const client = api.createRestClient(async (request) => {
  if (request.operationId === 'createTask') {
    const input = request.body ?? {};
    if (!input.title || !String(input.title).trim()) {
      return { ok: false, status: 400, error: 'title is required' };
    }
    const category = await database.stores.categories.getOneById(input.categoryId);
    if (!category.result) {
      return { ok: false, status: 404, error: 'category not found' };
    }
    const task = { id: crypto.randomUUID(), ...input, completed: false };
    await database.stores.tasks.create(task.id, task);
    return { ok: true, status: 201, result: task };
  }
  if (request.operationId === 'listTasks') {
    const tasks = await database.stores.tasks.getAll({}, { page: 1, size: 20 });
    return { ok: true, status: 200, result: tasks.result };
  }
  return { ok: false, status: 404, error: 'unknown operationId' };
});

const created = await client.request({
  operationId: 'createTask',
  method: 'POST',
  path: '/tasks',
  body: { title: 'Publish first REST MVP', categoryId: 'work' }
});
const rejected = await client.request({
  operationId: 'createTask',
  method: 'POST',
  path: '/tasks',
  body: { title: '', categoryId: 'work' }
});
const listed = await client.request({ operationId: 'listTasks', method: 'GET', path: '/tasks' });

return {
  created: created.status,
  rejected: rejected.status,
  listed: listed.status,
  total: listed.result.length,
  firstTask: listed.result[0].title
};`
  },
  {
    id: 'realtime-mvp-live',
    title: { en: 'Realtime MVP Day 1 — live command with ack and broadcast', 'pt-BR': 'MVP realtime Dia 1 — comando live com ack e broadcast' },
    description: {
      en: 'Wire a WebSocket client to a mediator handler that persists through the in-memory adapter and broadcasts the created event.',
      'pt-BR': 'Ligue um client WebSocket a um handler do mediator que persiste pelo adaptador in-memory e transmite o evento de criação.'
    },
    code: `const database = api.createInMemoryDatabase({ stores: ['categories', 'tasks'] });
const mediator = api.createMessageMediator();
await database.connect();
await database.stores.categories.create('work', { id: 'work', name: 'Work' });

const liveCards = [];
await mediator.subscribe('tasks.created', async (event) => {
  liveCards.push(event.payload.title);
});

mediator.registerHandler('tasks.create.v1', async (message) => {
  const category = await database.stores.categories.getOneById(message.payload.categoryId);
  if (!category.result) {
    return { ok: false, error: 'category not found' };
  }
  const task = {
    id: crypto.randomUUID(),
    title: message.payload.title,
    categoryId: message.payload.categoryId,
    completed: false
  };
  await database.stores.tasks.create(task.id, task);
  await mediator.publish({ name: 'tasks.created', payload: task });
  return { ok: true, result: task };
});

const socket = api.createWebSocketClient((request) => mediator.request({
  contract: 'tasks.create.v1',
  payload: request.input,
  metadata: { transport: 'websocket' }
}));

await socket.connect();
const ack = await socket.request({
  operationId: 'tasks.create',
  input: { title: 'Show realtime status', categoryId: 'work' }
});
const rejected = await socket.request({
  operationId: 'tasks.create',
  input: { title: 'No owner', categoryId: 'missing' }
});
await socket.disconnect();

return {
  ack: ack.ok,
  createdTask: ack.result.title,
  rejectedError: rejected.error,
  broadcastedToUi: liveCards
};`
  },
  {
    id: 'realtime-mvp-fallback',
    title: { en: 'Realtime MVP Day 2 — REST fallback parity drill', 'pt-BR': 'MVP realtime Dia 2 — drill de paridade do fallback REST' },
    description: {
      en: 'Kill the socket handler and prove the REST fallback returns the same business result through the same in-memory adapter.',
      'pt-BR': 'Derrube o handler do socket e prove que o fallback REST retorna o mesmo resultado de negócio pelo mesmo adaptador in-memory.'
    },
    code: `const database = api.createInMemoryDatabase({ stores: ['categories', 'tasks'] });
await database.connect();
await database.stores.categories.create('work', { id: 'work', name: 'Work' });

async function createTaskUseCase(input) {
  const task = {
    id: crypto.randomUUID(),
    title: input.title,
    categoryId: input.categoryId,
    completed: false
  };
  await database.stores.tasks.create(task.id, task);
  return { ok: true, result: task };
}

const downSocket = api.createWebSocketClient(async () => {
  throw new Error('socket unavailable');
});
const restFallback = api.createRestClient((request) => createTaskUseCase(request.body));

async function createTaskWithFallback(input) {
  try {
    const live = await downSocket.request({ operationId: 'tasks.create', input });
    return { transport: 'websocket', result: live };
  } catch {
    const fallback = await restFallback.request({
      operationId: 'createTask',
      method: 'POST',
      path: '/tasks',
      body: input
    });
    return { transport: 'rest', result: fallback };
  }
}

const response = await createTaskWithFallback({ title: 'Fallback parity task', categoryId: 'work' });
const stored = await database.stores.tasks.getAll({}, { page: 1, size: 10 });

return {
  transportUsed: response.transport,
  ok: response.result.ok,
  storedTotal: stored.total,
  storedTitle: response.result.result.title
};`
  },
  {
    id: 'saas-mvp-tenant',
    title: { en: 'SaaS MVP Day 1 — tenant policy on the in-memory adapter', 'pt-BR': 'MVP SaaS Dia 1 — policy de tenant no adaptador in-memory' },
    description: {
      en: 'Prove the tenant guard: org-1 writes its own task, org-2 is denied, and the store only holds the legitimate record.',
      'pt-BR': 'Prove a guarda de tenant: org-1 escreve a própria task, org-2 é negado e o store só guarda o registro legítimo.'
    },
    code: `const database = api.createInMemoryDatabase({ stores: ['categories', 'tasks'] });
await database.connect();
await database.stores.categories.create('work', { id: 'work', name: 'Work' });

async function createTenantTask(context, input) {
  if (context.organizationId !== input.organizationId) {
    return { ok: false, status: 403, error: 'tenant access denied' };
  }
  const task = {
    id: crypto.randomUUID(),
    organizationId: input.organizationId,
    title: input.title,
    categoryId: input.categoryId
  };
  await database.stores.tasks.create(task.id, task);
  return { ok: true, status: 201, result: task };
}

const own = await createTenantTask(
  { organizationId: 'org-1', userId: 'user-1' },
  { organizationId: 'org-1', title: 'Tenant scoped task', categoryId: 'work' }
);
const denied = await createTenantTask(
  { organizationId: 'org-2', userId: 'user-2' },
  { organizationId: 'org-1', title: 'Cross-tenant write', categoryId: 'work' }
);
const org1Tasks = await database.stores.tasks.getByRelation('organizationId', 'org-1');
const org2Tasks = await database.stores.tasks.getByRelation('organizationId', 'org-2');

return {
  ownWrite: own.status,
  crossTenantWrite: denied.status,
  org1Sees: org1Tasks.result.map((task) => task.title),
  org2Sees: org2Tasks.result.length
};`
  },
  {
    id: 'micro-mvp-worker',
    title: { en: 'Microservices MVP Day 2 — worker persisting real notifications', 'pt-BR': 'MVP microsserviços Dia 2 — worker persistindo notificações reais' },
    description: {
      en: 'Subscribe a notification worker to the mediator and persist each delivery in its own in-memory store — no fake HTTP endpoint.',
      'pt-BR': 'Assine um worker de notificação no mediator e persista cada entrega no próprio store in-memory — sem endpoint HTTP falso.'
    },
    code: `const database = api.createInMemoryDatabase({ stores: ['tasks', 'notifications'] });
const mediator = api.createMessageMediator();
await database.connect();

await mediator.subscribe('tasks.created.v1', async (event) => {
  await database.stores.notifications.create(crypto.randomUUID(), {
    template: 'task-created',
    taskId: event.payload.id,
    title: event.payload.title
  });
});

mediator.registerHandler('tasks.create.v1', async (message) => {
  const task = {
    id: crypto.randomUUID(),
    title: message.payload.title,
    categoryId: message.payload.categoryId,
    completed: false
  };
  await database.stores.tasks.create(task.id, task);
  await mediator.publish({ name: 'tasks.created.v1', payload: task });
  return { ok: true, result: task };
});

const created = await mediator.request({
  contract: 'tasks.create.v1',
  payload: { title: 'Notify assignee', categoryId: 'work' }
});
const sent = await database.stores.notifications.getAll({}, { page: 1, size: 10 });

return {
  task: created.result.title,
  notificationsDelivered: sent.total,
  firstNotification: sent.result[0]
};`
  },
  {
    id: 'micro-mvp-dead-letter',
    title: { en: 'Microservices MVP Release — explicit failure with DLQ replay', 'pt-BR': 'MVP microsserviços Release — falha explícita com replay via DLQ' },
    description: {
      en: 'Route a poison message to the dead-letter queue and replay it, proving the failure mode is explicit and measured.',
      'pt-BR': 'Envie uma mensagem venenosa para a dead-letter queue e reprocesse, provando que o modo de falha é explícito e medido.'
    },
    code: `const deadLetterQueue = api.createDeadLetterQueue({ maxAttempts: 2 });
const mediator = api.createMessageMediator();

mediator.registerHandler('tasks.create.v1', async (message) => {
  if (!message.payload.title) {
    const record = await deadLetterQueue.enqueue({
      entityName: 'Task',
      resourceId: message.payload.categoryId ?? 'unknown',
      operation: 'tasks.create.v1',
      payload: message.payload
    });
    return { ok: false, error: 'queued for replay', deadLetterId: record.id };
  }
  return { ok: true, result: { id: crypto.randomUUID(), ...message.payload } };
});

const failed = await mediator.request({
  contract: 'tasks.create.v1',
  payload: { categoryId: 'work' }
});
const report = await deadLetterQueue.replay({
  'tasks.create.v1': async (record) => {
    if (!record.payload.title) throw new Error('title is required');
    return record.id;
  }
});
const after = await deadLetterQueue.find(failed.deadLetterId);

return {
  firstAttempt: failed.error,
  replayReport: report,
  statusAfterReplay: after.status,
  lastError: after.lastError
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
  },
  {
    id: 'micro-mvp-mediator',
    title: { en: 'Microservices MVP Day 1 — contract over the in-memory mediator', 'pt-BR': 'MVP microsserviços Dia 1 — contrato sobre o mediator in-memory' },
    description: {
      en: 'Prove request/response and publish/listen on the real in-memory mediator, including the explicit error for an unknown contract.',
      'pt-BR': 'Prove request/response e publish/listen no mediator in-memory real, incluindo o erro explícito para contrato desconhecido.'
    },
    code: `const mediator = api.createInMemory();
const receivedEvents = [];

await mediator.subscribe('tasks.created.v1', async (event) => {
  receivedEvents.push(event.payload.title);
});

mediator.registerHandler('tasks.create.v1', async (message) => {
  const task = {
    id: crypto.randomUUID(),
    title: message.payload.title,
    categoryId: message.payload.categoryId,
    completed: false
  };
  await mediator.publish({ name: 'tasks.created.v1', payload: task });
  return { ok: true, result: task };
});

const created = await mediator.request({
  contract: 'tasks.create.v1',
  payload: { title: 'Notify assignee', categoryId: 'work' }
});
const unknown = await mediator.request({
  contract: 'tasks.unknown.v1',
  payload: {}
});

return {
  createdTask: created.result.title,
  eventDelivered: receivedEvents,
  unknownContractError: unknown.error
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
