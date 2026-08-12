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
