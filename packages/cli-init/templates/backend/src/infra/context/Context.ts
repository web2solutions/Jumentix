import { AsyncLocalStorage } from 'node:async_hooks';

const MAX_DURATION_SAMPLES = 256;
const MAX_CORRELATION_IDS = 20;
const MAX_RECENT_STORES = 20;
const SENSITIVE_KEY = /password|token|secret|authorization|cookie/i;

type MetricsState = {
  active: number;
  enteredTotal: number;
  exitedTotal: number;
  errorTotal: number;
  durationSumMs: number;
  durationCount: number;
  durations: number[];
  lastCorrelationIds: string[];
  recentStores: Array<{ collectedAt: string; entries: Record<string, unknown> }>;
};

const state: MetricsState = {
  active: 0,
  enteredTotal: 0,
  exitedTotal: 0,
  errorTotal: 0,
  durationSumMs: 0,
  durationCount: 0,
  durations: [],
  lastCorrelationIds: [],
  recentStores: []
};

const storage = new AsyncLocalStorage<Map<unknown, unknown>>();

function percentile95(samples: number[]): number {
  if (!samples.length) return 0;
  const sorted = [...samples].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1);
  return sorted[Math.max(0, index)];
}

function serializeValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  const type = typeof value;
  if (type === 'string' || type === 'number' || type === 'boolean') return value;
  if (type === 'bigint') return String(value);
  if (Array.isArray(value)) return value.map(serializeValue);
  if (value instanceof Map) {
    const object: Record<string, unknown> = {};
    value.forEach((entry, key) => {
      object[String(key)] = serializeValue(entry);
    });
    return object;
  }
  if (type === 'object') {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (_error) {
      return '[unserializable]';
    }
  }
  return String(value);
}

export function redactSensitive(value: unknown, keyHint = ''): unknown {
  if (keyHint && SENSITIVE_KEY.test(keyHint)) return '[REDACTED]';
  if (Array.isArray(value)) return value.map((entry) => redactSensitive(entry));
  if (value && typeof value === 'object') {
    const object: Record<string, unknown> = {};
    Object.entries(value as Record<string, unknown>).forEach(([key, entry]) => {
      object[key] = redactSensitive(entry, key);
    });
    return object;
  }
  return value;
}

function snapshotStoreEntries(store: Map<unknown, unknown> | undefined): Record<string, unknown> {
  const entries: Record<string, unknown> = {};
  if (!store || typeof store.forEach !== 'function') return entries;
  store.forEach((value, key) => {
    const keyName = String(key);
    entries[keyName] = redactSensitive(serializeValue(value), keyName);
  });
  return entries;
}

function pushRecentStore(store: Map<unknown, unknown> | undefined): void {
  state.recentStores.push({
    collectedAt: new Date().toISOString(),
    entries: snapshotStoreEntries(store)
  });
  if (state.recentStores.length > MAX_RECENT_STORES) {
    state.recentStores.shift();
  }
}

function pushCorrelationId(store: Map<unknown, unknown> | undefined): void {
  if (!store || typeof store.get !== 'function') return;
  const value = store.get('correlationId');
  if (typeof value !== 'string' || !value) return;
  state.lastCorrelationIds.push(value);
  if (state.lastCorrelationIds.length > MAX_CORRELATION_IDS) {
    state.lastCorrelationIds.shift();
  }
}

function recordDuration(durationMs: number): void {
  if (!Number.isFinite(durationMs) || durationMs < 0) return;
  state.durationSumMs += durationMs;
  state.durationCount += 1;
  state.durations.push(durationMs);
  if (state.durations.length > MAX_DURATION_SAMPLES) {
    state.durations.shift();
  }
}

export function snapshotAsyncContextMetrics() {
  const avgDurationMs = state.durationCount > 0
    ? state.durationSumMs / state.durationCount
    : 0;
  const current = storage.getStore();
  return {
    active: state.active,
    enteredTotal: state.enteredTotal,
    exitedTotal: state.exitedTotal,
    errorTotal: state.errorTotal,
    avgDurationMs,
    p95Ms: percentile95(state.durations),
    lastCorrelationIds: [...state.lastCorrelationIds],
    recentStores: state.recentStores.map((entry) => ({
      collectedAt: entry.collectedAt,
      entries: { ...entry.entries }
    })),
    currentStore: current ? snapshotStoreEntries(current) : null,
    collectedAt: new Date().toISOString()
  };
}

export function resetAsyncContextMetricsForTests(): void {
  state.active = 0;
  state.enteredTotal = 0;
  state.exitedTotal = 0;
  state.errorTotal = 0;
  state.durationSumMs = 0;
  state.durationCount = 0;
  state.durations = [];
  state.lastCorrelationIds = [];
  state.recentStores = [];
}

export function runWithContext<T>(store: Map<unknown, unknown>, fn: () => T): T {
  const startedAt = Date.now();
  state.active += 1;
  state.enteredTotal += 1;
  pushCorrelationId(store);
  pushRecentStore(store);
  return storage.run(store, () => {
    let finished = false;
    const finish = (hadError: boolean) => {
      if (finished) return;
      finished = true;
      if (hadError) state.errorTotal += 1;
      state.active = Math.max(0, state.active - 1);
      state.exitedTotal += 1;
      recordDuration(Date.now() - startedAt);
    };
    try {
      const result = fn();
      if (result != null && typeof (result as unknown as { then?: unknown }).then === 'function') {
        return (result as unknown as Promise<unknown>).then(
          (value) => {
            finish(false);
            return value;
          },
          (error) => {
            finish(true);
            throw error;
          }
        ) as T;
      }
      finish(false);
      return result;
    } catch (error) {
      finish(true);
      throw error;
    }
  });
}

/**
 * Drop-in facade over AsyncLocalStorage that instruments every `run`.
 * Call sites keep using `Context.run` / `Context.getStore`.
 */
export const Context = {
  run: runWithContext,
  getStore: () => storage.getStore(),
  enterWith: (store: Map<unknown, unknown>) => storage.enterWith(store),
  disable: () => storage.disable()
};
