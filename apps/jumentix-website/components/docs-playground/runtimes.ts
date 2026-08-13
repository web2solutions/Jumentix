import type { DocsRuntime, DocsRuntimeId } from './types';
import { deleteEphemeralDatabase } from './runSnippet';

async function loadCana(sessionKey: string) {
  const cana = await import('@jumentix/cana');
  const dbName = `cana-docs-${sessionKey}`;
  return {
    api: cana as unknown as Record<string, unknown>,
    extras: { dbName },
    reset: () => deleteEphemeralDatabase(dbName)
  };
}

async function loadDesignerCore() {
  try {
    const mod = await import('@jumentix/designer-core') as unknown as Record<string, unknown>;
    const {
      collectModelIssues,
      normalizeStatePayload,
      buildSampleModelPayload
    } = mod;

    // Friendly alias: validate(stateOrRaw) → { ok, issues } using the real
    // collectModelIssues contract (domains/relationships), never a toy shape.
    const validate = (input: unknown) => {
      if (typeof collectModelIssues !== 'function') {
        return { ok: true, issues: [], note: 'designer-core stub' };
      }
      const state = typeof normalizeStatePayload === 'function'
        ? (normalizeStatePayload as (v: unknown) => unknown)(input)
        : input;
      const issues = (collectModelIssues as (v: unknown) => unknown[])(state);
      const list = Array.isArray(issues) ? issues : [];
      const errors = list.filter((issue) => (
        Boolean(issue)
        && typeof issue === 'object'
        && (issue as { severity?: string }).severity === 'error'
      ));
      return { ok: errors.length === 0, issues: list, errorCount: errors.length };
    };

    return {
      api: {
        ...mod,
        validate,
        collectModelIssues,
        normalizeStatePayload,
        buildSampleModelPayload
      }
    };
  } catch {
    return {
      api: {
        buildSampleModelPayload: () => ({ domains: [], relationships: [] }),
        normalizeStatePayload: (v: unknown) => v,
        collectModelIssues: () => [],
        validate: () => ({ ok: true, issues: [], note: 'designer-core stub' })
      }
    };
  }
}

type ServiceResult<T> = { result: T; error?: string };
type PlaygroundEvent = {
  name?: string;
  subject?: string;
  payload?: unknown;
  metadata?: Record<string, unknown>;
};
type PlaygroundMessage = {
  contract?: string;
  subject?: string;
  name?: string;
  payload?: unknown;
  metadata?: Record<string, unknown>;
};
type PlaygroundRecord = Record<string, unknown> & { id?: string };
type PlaygroundEventListener = (event: PlaygroundEvent) => unknown | Promise<unknown>;
type PlaygroundMessageHandler = (message: PlaygroundMessage) => unknown | Promise<unknown>;
type PlaygroundRestRequest = {
  operationId: string;
  method?: string;
  path?: string;
  body?: PlaygroundRecord;
};
type PlaygroundWebSocketRequest = {
  operationId: string;
  input?: PlaygroundRecord;
};
type PlaygroundDeadLetterStatus = 'pending' | 'succeeded' | 'abandoned';
type PlaygroundDeadLetterInput = {
  entityName: string;
  resourceId: string;
  operation: string;
  payload: unknown;
  actorId?: string;
};
type PlaygroundDeadLetterRecord = PlaygroundDeadLetterInput & {
  id: string;
  createdAt: string;
  updatedAt: string;
  attempts: number;
  status: PlaygroundDeadLetterStatus;
  lastError?: string;
};
type PlaygroundDeadLetterReplayReport = {
  replayed: string[];
  retried: string[];
  abandoned: string[];
  skipped: string[];
};
type PlaygroundDeadLetterReplayHandler = (
  record: PlaygroundDeadLetterRecord
) => unknown | Promise<unknown>;

function ok<T>(result: T): ServiceResult<T> {
  return { result };
}

function createKeyValueStorageApi() {
  const store = new Map<string, unknown>();
  return {
    connect: async () => ok(true),
    disconnect: async () => ok(true),
    set: async (key: string, value: unknown) => {
      store.set(key, value);
      return ok(true);
    },
    get: async (key: string) => ok(store.get(key) ?? null),
    del: async (key: string) => ok(store.delete(key)),
    clear: async () => {
      store.clear();
      return ok(true);
    }
  };
}

function createMessageMediatorApi() {
  const subscribers = new Map<string, Set<PlaygroundEventListener>>();
  const handlers = new Map<string, PlaygroundMessageHandler>();

  const contractName = (value: string | PlaygroundMessage | Record<string, unknown>) => {
    if (typeof value === 'string') return value;
    return String(value.contract ?? value.subject ?? value.name ?? '');
  };

  const eventName = (value: string | PlaygroundEvent) => {
    if (typeof value === 'string') return value;
    return String(value.name ?? value.subject ?? '');
  };

  return {
    subscribe: async (
      name: string,
      listener: PlaygroundEventListener
    ) => {
      const list = subscribers.get(name) ?? new Set<PlaygroundEventListener>();
      list.add(listener);
      subscribers.set(name, list);
      return ok(true);
    },
    publish: async (eventOrName: PlaygroundEvent | string, payload?: unknown) => {
      const event = typeof eventOrName === 'string'
        ? { name: eventOrName, payload }
        : eventOrName;
      const name = eventName(event);
      const list = Array.from(subscribers.get(name) ?? []);
      await Promise.all(list.map((listener) => listener(event)));
      return ok({ event: name, delivered: list.length });
    },
    registerHandler: (
      contract: string | PlaygroundMessage | Record<string, unknown>,
      handler: (message: PlaygroundMessage) => unknown | Promise<unknown>
    ) => {
      handlers.set(contractName(contract), handler);
      return ok(true);
    },
    request: async (message: PlaygroundMessage) => {
      const name = contractName(message);
      const handler = handlers.get(name);
      if (!handler) {
        return { ok: false, error: `handler not found: ${name}`, contract: name };
      }
      const response = await handler(message);
      if (response && typeof response === 'object' && ('ok' in response || 'result' in response || 'error' in response)) {
        return response;
      }
      return { ok: true, contract: name, result: response };
    }
  };
}

function createMutexApi() {
  const locks = new Set<string>();
  const lockKey = (resourceName: string, uuid = 'default') => `${resourceName}:${uuid}`;

  const service = {
    lock: async (resourceName: string, uuid = 'default') => {
      const key = lockKey(resourceName, uuid);
      if (locks.has(key)) {
        return ok({
          resourceName, uuid, key, locked: false, alreadyLocked: true
        });
      }
      locks.add(key);
      return ok({
        resourceName, uuid, key, locked: true, alreadyLocked: false
      });
    },
    isLocked: async (resourceName: string, uuid = 'default') => ok(locks.has(lockKey(resourceName, uuid))),
    unlock: async (resourceName: string, uuid = 'default') => ok(locks.delete(lockKey(resourceName, uuid))),
    acquire: async (name: string) => {
      const response = await service.lock(name);
      if (!response.result.locked) throw new Error(`lock busy: ${name}`);
      return { name, key: response.result.key };
    },
    release: async (lock: { name?: string; key?: string }) => {
      if (lock.key) {
        locks.delete(lock.key);
        return ok(true);
      }
      return service.unlock(String(lock.name ?? 'unknown'));
    }
  };

  return service;
}

function createDeadLetterQueueApi({
  maxAttempts = 5
}: { maxAttempts?: number } = {}) {
  if (maxAttempts < 1) throw new Error('dead letter queue requires maxAttempts of at least 1');

  const records = new Map<string, PlaygroundDeadLetterRecord>();
  let sequence = 0;
  const timestamp = () => new Date().toISOString();

  const clone = (record: PlaygroundDeadLetterRecord) => ({ ...record });
  const settle = async (
    record: PlaygroundDeadLetterRecord,
    status: PlaygroundDeadLetterStatus,
    lastError?: string
  ) => {
    const next = {
      ...record,
      status,
      updatedAt: timestamp(),
      ...(lastError ? { lastError } : {})
    };
    records.set(record.id, next);
  };

  return {
    enqueue: async (input: PlaygroundDeadLetterInput) => {
      if (!input.entityName) throw new Error('enqueue requires entityName');
      if (!input.resourceId) throw new Error('enqueue requires resourceId');
      if (!input.operation) throw new Error('enqueue requires operation');
      sequence += 1;
      const now = timestamp();
      const record: PlaygroundDeadLetterRecord = {
        id: `dlq-${sequence}`,
        entityName: input.entityName,
        resourceId: input.resourceId,
        operation: input.operation,
        payload: input.payload,
        actorId: input.actorId,
        createdAt: now,
        updatedAt: now,
        attempts: 0,
        status: 'pending'
      };
      records.set(record.id, record);
      return clone(record);
    },
    pending: async () => Array.from(records.values())
      .filter((record) => record.status === 'pending')
      .map(clone),
    list: async () => Array.from(records.values()).map(clone),
    find: async (id: string) => {
      const record = records.get(id);
      return record ? clone(record) : undefined;
    },
    replay: async (
      handlers: Record<string, PlaygroundDeadLetterReplayHandler>
    ): Promise<PlaygroundDeadLetterReplayReport> => {
      const report: PlaygroundDeadLetterReplayReport = {
        replayed: [], retried: [], abandoned: [], skipped: []
      };
      const pendingRecords = Array.from(records.values()).filter((item) => item.status === 'pending');

      const replayNext = async (index: number): Promise<void> => {
        const record = pendingRecords[index];
        if (!record) return;
        const handler = handlers[record.operation];
        if (!handler) {
          report.skipped.push(record.id);
          await replayNext(index + 1);
          return;
        }

        try {
          await handler(clone(record));
          await settle(record, 'succeeded');
          report.replayed.push(record.id);
        } catch (error) {
          const attempts = record.attempts + 1;
          const lastError = error instanceof Error ? error.message : String(error);
          if (attempts >= maxAttempts) {
            await settle({ ...record, attempts }, 'abandoned', lastError);
            report.abandoned.push(record.id);
            await replayNext(index + 1);
            return;
          }
          records.set(record.id, {
            ...record,
            attempts,
            updatedAt: timestamp(),
            lastError
          });
          report.retried.push(record.id);
        }

        await replayNext(index + 1);
      };

      await replayNext(0);

      return report;
    }
  };
}

function createInMemoryStore() {
  const records = new Map<string, PlaygroundRecord>();

  const normalize = (idOrRecord: string | PlaygroundRecord, value?: PlaygroundRecord) => {
    if (typeof idOrRecord === 'string') {
      return { ...(value ?? {}), id: value?.id ?? idOrRecord };
    }
    return { ...idOrRecord, id: idOrRecord.id ?? crypto.randomUUID() };
  };

  return {
    create: async (idOrRecord: string | PlaygroundRecord, value?: PlaygroundRecord) => {
      const record = normalize(idOrRecord, value);
      records.set(String(record.id), record);
      return ok(record);
    },
    update: async (id: string, patch: PlaygroundRecord) => {
      const current = records.get(id);
      if (!current) return { result: null, error: `record not found: ${id}` };
      const next = { ...current, ...patch, id };
      records.set(id, next);
      return ok(next);
    },
    getOneById: async (id: string) => ok(records.get(id) ?? null),
    delete: async (id: string) => ok(records.delete(id)),
    getByRelation: async (field: string, value: unknown) => ok(
      Array.from(records.values()).filter((record) => record[field] === value)
    ),
    getAll: async (
      filters: Record<string, unknown> = {},
      paging: { page?: number; size?: number } = {}
    ) => {
      const entries = Object.entries(filters).filter(([, value]) => (
        value !== undefined && value !== null
      ));
      let list = Array.from(records.values());
      for (const [field, value] of entries) {
        list = list.filter((record) => record[field] === value);
      }
      const total = list.length;
      const page = paging.page ?? 1;
      const size = paging.size ?? (total || 1);
      const start = (page - 1) * size;
      return {
        result: list.slice(start, start + size),
        total,
        page,
        size
      };
    }
  };
}

function createInMemoryDatabaseApi(config: { stores?: string[] } = {}) {
  const names = config.stores ?? ['categories', 'tasks'];
  const stores = Object.fromEntries(names.map((name) => [name, createInMemoryStore()]));
  return {
    stores,
    connect: async () => ok(true),
    disconnect: async () => ok(true)
  };
}

function createRestClientApi(
  handler?: (request: PlaygroundRestRequest) => unknown | Promise<unknown>
) {
  const tasks: PlaygroundRecord[] = [];
  return {
    request: async (request: PlaygroundRestRequest) => {
      if (handler) return handler(request);
      if (request.operationId === 'createTask' && request.body) {
        tasks.push(request.body);
        return {
          ok: true, status: 201, operationId: request.operationId, result: request.body
        };
      }
      return {
        ok: true, status: 200, operationId: request.operationId, result: tasks
      };
    }
  };
}

function createWebSocketClientApi(
  handler?: (request: PlaygroundWebSocketRequest) => unknown | Promise<unknown>
) {
  const tasks: PlaygroundRecord[] = [];
  return {
    connect: async () => ({ ok: true, status: 'connected' }),
    request: async (request: PlaygroundWebSocketRequest) => {
      if (handler) return handler(request);
      if (request.operationId === 'tasks.create' && request.input) {
        tasks.push(request.input);
        return { ok: true, operationId: request.operationId, result: request.input };
      }
      return { ok: true, operationId: request.operationId, result: tasks };
    },
    disconnect: async () => ({ ok: true, status: 'disconnected' })
  };
}

async function loadKv() {
  // Browser playground uses a contract-compatible in-memory stub so demos stay
  // independent of Node-oriented Redis adapters and private constructors.
  return {
    api: {
      createInMemory: createKeyValueStorageApi
    }
  };
}

async function loadMediator() {
  return {
    api: {
      createInMemory: createMessageMediatorApi
    }
  };
}

async function loadMutex() {
  return {
    api: {
      createKeyValueStorage: createKeyValueStorageApi,
      create: () => createMutexApi(),
      createDeadLetterQueue: createDeadLetterQueueApi
    }
  };
}

async function loadRestSdk() {
  return {
    api: {
      createMockClient: createRestClientApi
    }
  };
}

async function loadWsSdk() {
  return {
    api: {
      createFakeClient: createWebSocketClientApi
    }
  };
}

async function loadJumentixBrowserLab(sessionKey: string) {
  const cana = await import('@jumentix/cana') as unknown as Record<string, unknown>;
  const React = await import('react') as unknown as Record<string, unknown>;
  const designerCore = await loadDesignerCore();
  const dbPrefix = `jumentix-browser-lab-${sessionKey}`;
  return {
    api: {
      React,
      createInMemoryDatabase: createInMemoryDatabaseApi,
      createCanaDatabaseClient: cana.createCanaDatabaseClient,
      createCanaClient: cana.createClient,
      createCanaDatabaseName: (label = 'demo') => `${dbPrefix}-${label}-${Date.now()}`,
      createKeyValueStorage: createKeyValueStorageApi,
      createMessageMediator: createMessageMediatorApi,
      createMutex: () => createMutexApi(),
      createDeadLetterQueue: createDeadLetterQueueApi,
      createRestClient: createRestClientApi,
      createWebSocketClient: createWebSocketClientApi,
      createServiceModel: (input: Record<string, unknown>) => ({
        domains: [{
          id: 'tasks-domain',
          name: String(input.domain ?? 'Tasks'),
          entities: [
            { id: 'category', name: 'Category', fields: ['id', 'name', 'color'] },
            { id: 'task', name: 'Task', fields: ['id', 'title', 'categoryId', 'completed'] }
          ],
          app: input.app ?? 'service-management'
        }],
        relationships: [{
          id: 'task-category',
          from: 'task',
          to: 'category',
          type: 'many-to-one'
        }]
      }),
      validateDesign: (input: unknown) => (
        designerCore.api.validate as (value: unknown) => unknown
      )(input)
    },
    reset: () => deleteEphemeralDatabase(dbPrefix)
  };
}

const LOADERS: Record<
  DocsRuntimeId,
  (sessionKey: string) => Promise<{
    api: Record<string, unknown>;
    extras?: Record<string, unknown>;
    reset?: () => Promise<void>;
  }>
> = {
  cana: loadCana,
  'designer-core': async () => loadDesignerCore(),
  'jumentix-browser-lab': loadJumentixBrowserLab,
  'key-value-storage': async () => loadKv(),
  'message-mediator': async () => loadMediator(),
  'mutex-service': async () => loadMutex(),
  'sdk-rest-client': async () => loadRestSdk(),
  'sdk-websocket-client': async () => loadWsSdk()
};

const API_NAMES: Record<DocsRuntimeId, string> = {
  cana: 'cana',
  'designer-core': 'api',
  'jumentix-browser-lab': 'api',
  'key-value-storage': 'api',
  'message-mediator': 'api',
  'mutex-service': 'api',
  'sdk-rest-client': 'api',
  'sdk-websocket-client': 'api'
};

export function getRuntime(runtime: DocsRuntimeId): DocsRuntime {
  return {
    id: runtime,
    apiGlobalName: API_NAMES[runtime],
    load: LOADERS[runtime]
  };
}
