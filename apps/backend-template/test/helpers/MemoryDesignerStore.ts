/**
 * MemoryDesignerStore — in-memory `IDesignerStore` TEST DOUBLE for the
 * service-management designer suites.
 *
 * It preserves the test-facing semantics the RETIRED
 * `LocalStorageDesignerStore` fixture provided: work is performed
 * synchronously over an injected Map-backed storage double and every method
 * returns an already-resolved Promise, so the designer-core suites keep
 * asserting the pinned Requirement 126 Contract 2 wire format without a DOM
 * and without microtask-timing flakiness.
 *
 * This is a test double, NOT a runtime adapter: JUM-484 made Cana the sole
 * designer store and deleted every production path to localStorage (decision
 * 2026-07-29). Nothing under `apps/` may import this file.
 */

type StorageLike = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

function errorReason(error: unknown): string {
  return String((error as Error)?.message || error);
}

export class MemoryDesignerStore {
  storage: StorageLike;

  stateKey: string;

  baselineKey: string;

  constructor({
    storage,
    stateKey,
    baselineKey
  }: {
    storage: StorageLike;
    stateKey?: string;
    baselineKey?: string;
  }) {
    this.storage = storage;
    this.stateKey = stateKey || 'service-management.v1';
    this.baselineKey = baselineKey || 'service-management.schema-baseline.v1';
  }

  probe(): Promise<{ status: string; reason?: string }> {
    if (!this.storage) return Promise.resolve({ status: 'unavailable', reason: 'no storage backend' });
    try {
      const probeKey = `${this.stateKey}.probe`;
      this.storage.setItem(probeKey, '1');
      this.storage.removeItem(probeKey);
      return Promise.resolve({ status: 'available' });
    } catch (error) {
      return Promise.resolve({ status: 'unavailable', reason: errorReason(error) });
    }
  }

  load() {
    return this.readKey(this.stateKey);
  }

  loadBaseline() {
    return this.readKey(this.baselineKey);
  }

  readKey(key: string): Promise<{ status: string; payload: unknown; reason?: string }> {
    let raw: string | null;
    try {
      raw = this.storage.getItem(key);
    } catch (error) {
      return Promise.resolve({ status: 'unavailable', payload: null, reason: errorReason(error) });
    }
    if (raw === null || raw === undefined) {
      return Promise.resolve({ status: 'empty', payload: null });
    }
    try {
      return Promise.resolve({ status: 'ok', payload: JSON.parse(raw) });
    } catch (error) {
      return Promise.resolve({
        status: 'lost',
        payload: null,
        reason: `Stored payload under "${key}" is not readable JSON: ${errorReason(error)}`
      });
    }
  }

  save(payload: unknown) {
    this.storage.setItem(this.stateKey, JSON.stringify(payload));
    return Promise.resolve({ status: 'persisted' });
  }

  saveBaseline(snapshot: unknown) {
    this.storage.setItem(this.baselineKey, JSON.stringify(snapshot));
    return Promise.resolve({ status: 'persisted' });
  }

  clear() {
    this.storage.removeItem(this.stateKey);
    return Promise.resolve({ status: 'persisted' });
  }

  clearBaseline() {
    this.storage.removeItem(this.baselineKey);
    return Promise.resolve({ status: 'persisted' });
  }
}
