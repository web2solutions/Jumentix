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
    const candidate = mod.validate ?? mod.collectModelIssues;
    const validate = typeof candidate === 'function'
      ? (candidate as (design: unknown) => unknown)
      : (design: unknown) => ({ ok: true, design, note: 'designer-core stub' });
    return { api: { ...mod, validate } };
  } catch {
    return {
      api: {
        validate: (design: unknown) => ({ ok: true, design, note: 'designer-core stub' })
      }
    };
  }
}

async function loadKv() {
  // Browser playground uses a contract-compatible in-memory stub so demos stay
  // independent of Node-oriented Redis adapters and private constructors.
  const store = new Map<string, unknown>();
  return {
    api: {
      createInMemory: () => ({
        set: async (k: string, v: unknown) => {
          store.set(k, v);
        },
        get: async (k: string) => store.get(k)
      })
    }
  };
}

async function loadMediator() {
  const handlers = new Map<string, Array<(msg: unknown) => Promise<void>>>();
  return {
    api: {
      createInMemory: () => ({
        subscribe: async (topic: string, handler: (msg: unknown) => Promise<void>) => {
          const list = handlers.get(topic) ?? [];
          list.push(handler);
          handlers.set(topic, list);
        },
        publish: async (topic: string, msg: unknown) => {
          const list = handlers.get(topic) ?? [];
          await Promise.all(list.map((handler) => handler(msg)));
        }
      })
    }
  };
}

async function loadMutex() {
  const locks = new Set<string>();
  return {
    api: {
      create: () => ({
        acquire: async (name: string) => {
          if (locks.has(name)) throw new Error(`lock busy: ${name}`);
          locks.add(name);
          return { name };
        },
        release: async (lock: { name: string }) => {
          locks.delete(lock.name);
        }
      })
    }
  };
}

async function loadRestSdk() {
  return {
    api: {
      createMockClient: () => ({
        request: async ({ method, path }: { method: string; path: string }) => ({
          status: 200,
          method,
          path,
          body: { ok: true, mocked: true }
        })
      })
    }
  };
}

async function loadWsSdk() {
  return {
    api: {
      createFakeClient: () => ({
        connect: async () => 'connected',
        disconnect: async () => 'disconnected'
      })
    }
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
  'key-value-storage': async () => loadKv(),
  'message-mediator': async () => loadMediator(),
  'mutex-service': async () => loadMutex(),
  'sdk-rest-client': async () => loadRestSdk(),
  'sdk-websocket-client': async () => loadWsSdk()
};

const API_NAMES: Record<DocsRuntimeId, string> = {
  cana: 'cana',
  'designer-core': 'api',
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
