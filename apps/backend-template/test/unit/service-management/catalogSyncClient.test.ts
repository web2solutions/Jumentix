/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable jest/prefer-expect-assertions, jest/max-expects, jest/no-conditional-in-test */
import path from 'node:path';

/**
 * Unit suite for the shared-catalog sync client (JUM-491),
 * `apps/service-management/src/state/catalogSyncClient.js`.
 *
 * What is real here and what is a double, and why (Requirements 109/115):
 *
 * - The sync client, the `createDesignerState` core, the `CanaDesignerStore`
 *   port adapter and designerSync's `applyRemoteDocument` one-path are all
 *   REAL — the publish/push/pull/conflict/convergence behavior asserted here
 *   runs over the production code, end to end.
 * - The Cana client is the same declared in-memory double as the designerSync
 *   suite: Jumentix-owned ordered-listener semantics (committed events in
 *   cursor order to the subscribing instance).
 * - The catalog transport is a DECLARED in-memory double of the Jumentix
 *   catalog API port the client defines (`createCatalogHttpTransport`'s
 *   shape): it implements the backend's concurrency semantics — version 1 on
 *   create, reject-on-stale with a 409-shaped error, tombstone deletes,
 *   versioned restores — because those semantics are pinned against the REAL
 *   backend in
 *   `test/integration/ServiceManagement/catalogSync.integration.test.ts`.
 *   A scripted `down` flag simulates the partition for the convergence cases
 *   here; the integration test proves the same convergence over real HTTP
 *   with a real connection refusal.
 * - The scheduler is manual so the poll/push cycles are deterministic.
 */

const repoRoot = path.resolve(__dirname, '../../../../..');
const {
  createDesignerState,
  createDefaultView
} = require('@jumentix/designer-core/state/designerState.js');

const {
  createCatalogSyncClient,
  CATALOG_SYNC_POLL_INTERVAL_MS,
  CATALOG_SYNC_PUSH_DEBOUNCE_MS
} = require(path.join(repoRoot, 'apps', 'service-management', 'src', 'state', 'catalogSyncClient.js'));
const {
  CanaDesignerStore
} = require(path.join(repoRoot, 'apps', 'service-management', 'src', 'store', 'CanaDesignerStore.js'));

const STATE_KEY = 'service-management.v1';
const STORE_NAME = 'designerDocuments';

type Backend = { records: Map<string, string> };

/** The same declared Cana double as designerSync.test.ts, reduced to what
 * this suite drives: committed `put` events to this client's listeners. */
function createCanaClientDouble(backend: Backend, clientId: string) {
  const listeners = new Set<(event: any) => void>();
  let cursor = 0;
  let txSeq = 0;
  const client = {
    async open() { return undefined; },
    table(name: string) {
      return {
        name,
        async get(key: string) {
          return backend.records.has(key) ? backend.records.get(key) : undefined;
        }
      };
    },
    async transaction(
      _mode: string,
      _stores: readonly string[],
      body: (scope: any) => Promise<unknown>
    ) {
      const staged: Array<{ op: 'put' | 'delete'; key: string; value?: string }> = [];
      const scope = {
        table: () => ({
          async put(value: string, key: string) { staged.push({ op: 'put', key, value }); },
          async delete(key: string) { staged.push({ op: 'delete', key }); }
        }),
        abort: () => undefined
      };
      const result = await body(scope);
      txSeq += 1;
      staged.forEach(({ op, key, value }) => {
        if (op === 'put') backend.records.set(key, value as string);
        else backend.records.delete(key);
        cursor += 1;
        const event = {
          type: op === 'put' ? 'updated' : 'deleted',
          store: STORE_NAME,
          key,
          record: op === 'put' ? value : undefined,
          cursor,
          correlationId: `${clientId}:${txSeq}`,
          at: 1722000000000 + txSeq,
          originId: clientId
        };
        listeners.forEach((listener) => listener(event));
      });
      return {
        outcome: 'committed', result, events: [], correlationId: `${clientId}:${txSeq}`, attemptedAt: 1722000000000 + txSeq
      };
    },
    subscribe(listener: (event: any) => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    async storageState() {
      return { persistent: true, nearQuota: false, evicted: false };
    }
  };
  return { client, listeners };
}

/**
 * Declared in-memory double of the catalog transport port, implementing the
 * backend's concurrency contract: version 1 on create, reject-on-stale with a
 * 409-shaped error, tombstone deletes, versioned restores. `script.down`
 * refuses every call — the scripted partition.
 */
function createCatalogTransportDouble() {
  const records = new Map<string, any>();
  let seq = 0;
  const script: { down?: boolean; readError?: boolean; writeError?: boolean } = {};
  const guard = () => {
    if (script.down) {
      throw new Error('connect ECONNREFUSED 127.0.0.1:9 — scripted partition');
    }
  };
  const copy = (record: any) => JSON.parse(JSON.stringify(record));
  const notFound = (id: string) => {
    const error: any = new Error(`catalog ${id} not found`);
    error.status = 404;
    return error;
  };
  const stale = () => {
    const error: any = new Error('stale catalog version');
    error.status = 409;
    return error;
  };
  return {
    records,
    script,
    async listCatalogs({ includeDeleted = false }: { includeDeleted?: boolean } = {}) {
      guard();
      return [...records.values()]
        .filter((record) => includeDeleted || !record.deletedAt)
        .map(copy);
    },
    async getCatalog(id: string) {
      guard();
      if (script.readError) throw new Error('read failed — scripted');
      const record = records.get(id);
      if (!record) throw notFound(id);
      return copy(record);
    },
    async createCatalog(body: any) {
      guard();
      seq += 1;
      const record = {
        id: `catalog-${seq}`,
        organization: 'org-1',
        name: body.name,
        description: body.description ?? '',
        version: 1,
        design: body.design,
        provenance: body.provenance,
        createdBy: 'test-actor',
        updatedBy: 'test-actor',
        createdAt: '2026-08-08T00:00:00.000Z',
        updatedAt: '2026-08-08T00:00:00.000Z',
        deletedAt: ''
      };
      records.set(record.id, record);
      return copy(record);
    },
    async updateCatalog(id: string, body: any) {
      guard();
      if (script.writeError) {
        const error: any = new Error('write failed — scripted');
        error.status = 500;
        throw error;
      }
      const record = records.get(id);
      if (!record) throw notFound(id);
      if (record.version !== body.version) throw stale();
      record.version += 1;
      if (body.name !== undefined) record.name = body.name;
      if (body.description !== undefined) record.description = body.description;
      if (body.design !== undefined) record.design = body.design;
      if (body.provenance !== undefined) record.provenance = body.provenance;
      return copy(record);
    },
    async deleteCatalog(id: string, version: number) {
      guard();
      const record = records.get(id);
      if (!record) throw notFound(id);
      if (record.version !== version) throw stale();
      record.deletedAt = '2026-08-08T01:00:00.000Z';
      record.version += 1;
      return true;
    },
    async restoreCatalog(id: string, version: number) {
      guard();
      const record = records.get(id);
      if (!record) throw notFound(id);
      if (record.version !== version) throw stale();
      record.deletedAt = '';
      record.version += 1;
      return copy(record);
    }
  };
}

function makeEntity(id: string, name: string) {
  return {
    id,
    name,
    x: 14,
    y: 14,
    fields: [],
    meta: {
      aggregateRoot: false, invariants: [], rbac: {}, contracts: [], oasComposition: {}
    }
  };
}

function makeDomain(id: string, name: string, entities: any[] = []) {
  return {
    id, name, color: '#60a5fa', x: 10, y: 10, context: {}, entities
  };
}

let clientSeq = 0; // eslint-disable-line jest/require-hook

/** A full designer host: real store + real state core + real sync client,
 * over the transport double, with a manually-flushed scheduler. */
async function createHost(seedDomains: any[] = []) {
  clientSeq += 1;
  const backend: Backend = { records: new Map<string, string>() };
  const { client } = createCanaClientDouble(backend, `host-${clientSeq}`);
  const store = new CanaDesignerStore({ client });
  const transport = createCatalogTransportDouble();
  const renders: string[] = [];
  const notifications: Array<{ message: string; severity: string }> = [];
  const timers: Map<number, { fn: () => unknown; ms: number }> = new Map();
  let timerSeq = 0;
  let core: any;
  const seed = () => {
    core.state.domains = JSON.parse(JSON.stringify(seedDomains));
    core.state.selectedDomainId = seedDomains[0]?.id ?? null;
    core.state.idCounter = 100;
    core.state.view = createDefaultView();
  };
  core = createDesignerState({
    store,
    seed,
    render: () => renders.push('render')
  });
  await core.loadState();
  const schedule = (fn: () => unknown, ms: number) => {
    timerSeq += 1;
    timers.set(timerSeq, { fn, ms });
    return timerSeq;
  };
  const cancelSchedule = (handle: number) => { timers.delete(handle); };
  const syncClient = createCatalogSyncClient({
    designerState: core,
    store,
    transport,
    render: () => renders.push('sync-render'),
    notify: (message: string, severity: string) => notifications.push({ message, severity }),
    schedule,
    cancelSchedule
  });
  const flushTimers = async () => {
    const pending = [...timers.entries()];
    timers.clear();
    for (const [, timer] of pending) {
      // eslint-disable-next-line no-await-in-loop
      await timer.fn();
    }
  };
  return {
    backend, store, transport, core, syncClient, renders, notifications, timers, flushTimers
  };
}

/** Simulate a teammate's write straight into the "server". */
function teammateWritesDomain(transport: any, domain: any, name?: string) {
  return transport.createCatalog({
    name: name || domain.name,
    design: { kind: 'domain-package', version: '2.0.0', domain }
  });
}

describe('catalogSyncClient — publish and outbound push', () => {
  it('publishDomain creates the remote record at version 1 and persists the marker', async () => {
    expect.hasAssertions();
    const host = await createHost([makeDomain('domain-1', 'Billing', [makeEntity('entity-1', 'Invoice')])]);
    await host.syncClient.start();
    host.timers.clear();

    const { published, record } = await host.syncClient.publishDomain('domain-1');
    expect(published).toBe(true);
    expect(record.version).toBe(1);
    expect(host.core.state.domains[0].context.catalog).toStrictEqual({
      id: record.id,
      version: 1,
      contentHash: host.core.state.domains[0].context.catalog.contentHash
    });

    const stored = JSON.parse(host.backend.records.get(STATE_KEY) as string);
    expect(stored.domains[0].context.catalog.id).toBe(record.id);
    expect(host.syncClient.getStatus().sharedCount).toBe(1);
    await host.syncClient.stop();
  });

  it('a committed local edit is pushed after the debounce and the marker rebases', async () => {
    expect.hasAssertions();
    const host = await createHost([makeDomain('domain-1', 'Billing', [makeEntity('entity-1', 'Invoice')])]);
    await host.syncClient.start();
    host.timers.clear();
    const { record } = await host.syncClient.publishDomain('domain-1');
    host.timers.clear();

    host.core.state.domains[0].entities.push(makeEntity('entity-2', 'Payment'));
    await host.core.saveState();
    await host.flushTimers();

    const remote = await host.transport.getCatalog(record.id);
    expect(remote.version).toBe(2);
    expect(remote.design.domain.entities).toHaveLength(2);
    expect(host.core.state.domains[0].context.catalog.version).toBe(2);
    expect(host.syncClient.getConflicts()).toHaveLength(0);
    await host.syncClient.stop();
  });

  it('a clean domain is not re-pushed — the debounced cycle is a no-op', async () => {
    expect.hasAssertions();
    const host = await createHost([makeDomain('domain-1', 'Billing')]);
    await host.syncClient.start();
    host.timers.clear();
    const { record } = await host.syncClient.publishDomain('domain-1');
    await host.flushTimers();
    host.timers.clear();

    const remote = await host.transport.getCatalog(record.id);
    expect(remote.version).toBe(1);
    await host.syncClient.stop();
  });
});

describe('catalogSyncClient — inbound read-back and convergence', () => {
  it('a teammate-published record is admitted with its marker on the next read-back', async () => {
    expect.hasAssertions();
    const host = await createHost([]);
    await host.syncClient.start();
    host.timers.clear();

    await teammateWritesDomain(host.transport, makeDomain('domain-remote', 'Shipping', [makeEntity('entity-9', 'Shipment')]));
    const result = await host.syncClient.syncNow();

    expect(result.synced).toBe(true);
    expect(host.core.state.domains).toHaveLength(1);
    expect(host.core.state.domains[0].name).toBe('Shipping');
    expect(host.core.state.domains[0].context.catalog.id).toBe('catalog-1');
    expect(host.renders.length).toBeGreaterThan(0);
    const stored = JSON.parse(host.backend.records.get(STATE_KEY) as string);
    expect(stored.domains[0].name).toBe('Shipping');
    await host.syncClient.stop();
  });

  it('a teammate update to a clean shared domain is applied and persisted', async () => {
    expect.hasAssertions();
    const host = await createHost([makeDomain('domain-1', 'Billing')]);
    await host.syncClient.start();
    host.timers.clear();
    const { record } = await host.syncClient.publishDomain('domain-1');
    host.timers.clear();

    const remoteDomain = makeDomain('domain-1', 'Billing', [makeEntity('entity-7', 'CreditNote')]);
    await host.transport.updateCatalog(record.id, {
      version: 1,
      design: { kind: 'domain-package', version: '2.0.0', domain: remoteDomain }
    });
    await host.syncClient.syncNow();

    expect(host.core.state.domains[0].entities.map((entity: any) => entity.name)).toContain('CreditNote');
    expect(host.core.state.domains[0].context.catalog.version).toBe(2);
    await host.syncClient.stop();
  });

  it('a teammate delete removes the clean local copy — tombstones propagate', async () => {
    expect.hasAssertions();
    const host = await createHost([makeDomain('domain-1', 'Billing')]);
    await host.syncClient.start();
    host.timers.clear();
    const { record } = await host.syncClient.publishDomain('domain-1');
    host.timers.clear();

    await host.transport.deleteCatalog(record.id, 1);
    await host.syncClient.syncNow();

    expect(host.core.state.domains).toHaveLength(0);
    const stored = JSON.parse(host.backend.records.get(STATE_KEY) as string);
    expect(stored.domains).toHaveLength(0);
    await host.syncClient.stop();
  });

  it('a restored record is re-admitted on the read-back — deletion is recoverable', async () => {
    expect.hasAssertions();
    const host = await createHost([makeDomain('domain-1', 'Billing')]);
    await host.syncClient.start();
    host.timers.clear();
    const { record } = await host.syncClient.publishDomain('domain-1');
    host.timers.clear();

    await host.transport.deleteCatalog(record.id, 1);
    await host.syncClient.syncNow();
    expect(host.core.state.domains).toHaveLength(0);

    await host.transport.restoreCatalog(record.id, 2);
    await host.syncClient.syncNow();
    expect(host.core.state.domains).toHaveLength(1);
    expect(host.core.state.domains[0].name).toBe('Billing');
    expect(host.core.state.domains[0].context.catalog.version).toBe(3);
    await host.syncClient.stop();
  });
});

describe('catalogSyncClient — conflicts are reviewable, never destructive', () => {
  it('a stale push raises a conflict and keeps the local edit', async () => {
    expect.hasAssertions();
    const host = await createHost([makeDomain('domain-1', 'Billing', [makeEntity('entity-1', 'Invoice')])]);
    await host.syncClient.start();
    host.timers.clear();
    const { record } = await host.syncClient.publishDomain('domain-1');
    host.timers.clear();

    // A teammate moves the server to version 2 while the local marker is at 1.
    await host.transport.updateCatalog(record.id, {
      version: 1,
      design: { kind: 'domain-package', version: '2.0.0', domain: makeDomain('domain-1', 'Billing', [makeEntity('entity-2', 'TeammateEntity')]) }
    });
    host.core.state.domains[0].entities.push(makeEntity('entity-3', 'LocalEntity'));
    await host.core.saveState();
    await host.flushTimers();

    const conflicts = host.syncClient.getConflicts();
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({
      catalogId: record.id, domainId: 'domain-1', reason: 'stale-write', serverVersion: 2, baseVersion: 1
    });
    // The local edit survives; the server still holds the teammate's version.
    expect(host.core.state.domains[0].entities.map((entity: any) => entity.name)).toContain('LocalEntity');
    const remote = await host.transport.getCatalog(record.id);
    expect(remote.version).toBe(2);
    expect(remote.design.domain.entities[0].name).toBe('TeammateEntity');
    expect(host.notifications.some((entry) => entry.severity === 'error' && entry.message.includes('conflicts'))).toBe(true);
    await host.syncClient.stop();
  });

  it('take-local re-pushes the local design against the current server version', async () => {
    expect.hasAssertions();
    const host = await createHost([makeDomain('domain-1', 'Billing', [makeEntity('entity-1', 'Invoice')])]);
    await host.syncClient.start();
    host.timers.clear();
    const { record } = await host.syncClient.publishDomain('domain-1');
    host.timers.clear();

    await host.transport.updateCatalog(record.id, {
      version: 1,
      design: { kind: 'domain-package', version: '2.0.0', domain: makeDomain('domain-1', 'Billing', [makeEntity('entity-2', 'TeammateEntity')]) }
    });
    host.core.state.domains[0].entities.push(makeEntity('entity-3', 'LocalEntity'));
    await host.core.saveState();
    await host.flushTimers();
    expect(host.syncClient.getConflicts()).toHaveLength(1);

    const { resolved } = await host.syncClient.resolveConflict(record.id, 'take-local');
    expect(resolved).toBe(true);
    const remote = await host.transport.getCatalog(record.id);
    expect(remote.version).toBe(3);
    expect(remote.design.domain.entities.map((entity: any) => entity.name)).toContain('LocalEntity');
    expect(host.core.state.domains[0].context.catalog.version).toBe(3);
    expect(host.syncClient.getConflicts()).toHaveLength(0);
    await host.syncClient.stop();
  });

  it('take-server replaces the local domain with the server design', async () => {
    expect.hasAssertions();
    const host = await createHost([makeDomain('domain-1', 'Billing', [makeEntity('entity-1', 'Invoice')])]);
    await host.syncClient.start();
    host.timers.clear();
    const { record } = await host.syncClient.publishDomain('domain-1');
    host.timers.clear();

    await host.transport.updateCatalog(record.id, {
      version: 1,
      design: { kind: 'domain-package', version: '2.0.0', domain: makeDomain('domain-1', 'Billing', [makeEntity('entity-2', 'TeammateEntity')]) }
    });
    host.core.state.domains[0].entities.push(makeEntity('entity-3', 'LocalEntity'));
    await host.core.saveState();
    await host.flushTimers();
    expect(host.syncClient.getConflicts()).toHaveLength(1);

    const { resolved } = await host.syncClient.resolveConflict(record.id, 'take-server');
    expect(resolved).toBe(true);
    expect(host.core.state.domains[0].entities.map((entity: any) => entity.name)).toStrictEqual(['TeammateEntity']);
    expect(host.core.state.domains[0].context.catalog.version).toBe(2);
    expect(host.syncClient.getConflicts()).toHaveLength(0);
    await host.syncClient.stop();
  });

  it('take-server tolerates a context-less server domain while rebasing the marker', async () => {
    expect.hasAssertions();
    const host = await createHost([makeDomain('domain-1', 'Billing', [makeEntity('entity-1', 'Invoice')])]);
    await host.syncClient.start();
    host.timers.clear();
    const { record } = await host.syncClient.publishDomain('domain-1');
    host.timers.clear();

    await host.transport.updateCatalog(record.id, {
      version: 1,
      design: {
        kind: 'domain-package',
        version: '2.0.0',
        domain: { id: 'remote-domain', name: 'Billing', entities: [makeEntity('entity-2', 'RemoteOnly')] }
      }
    });
    host.core.state.domains[0].entities.push(makeEntity('entity-3', 'LocalEntity'));
    await host.core.saveState();
    await host.flushTimers();

    const { resolved } = await host.syncClient.resolveConflict(record.id, 'take-server');
    expect(resolved).toBe(true);
    expect(host.core.state.domains[0].context.catalog.version).toBe(2);
    expect(host.core.state.domains[0].entities.map((entity: any) => entity.name)).toStrictEqual(['RemoteOnly']);
    await host.syncClient.stop();
  });

  it('a remote delete over a dirty local copy raises a conflict instead of deleting', async () => {
    expect.hasAssertions();
    const host = await createHost([makeDomain('domain-1', 'Billing', [makeEntity('entity-1', 'Invoice')])]);
    await host.syncClient.start();
    host.timers.clear();
    const { record } = await host.syncClient.publishDomain('domain-1');
    host.timers.clear();

    host.core.state.domains[0].entities.push(makeEntity('entity-3', 'LocalEntity'));
    await host.core.saveState();
    host.timers.clear();
    await host.transport.deleteCatalog(record.id, 1);
    await host.syncClient.syncNow();

    const conflicts = host.syncClient.getConflicts();
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].reason).toBe('deleted-remotely');
    expect(host.core.state.domains).toHaveLength(1);
    expect(host.core.state.domains[0].entities.map((entity: any) => entity.name)).toContain('LocalEntity');
    await host.syncClient.stop();
  });
});

describe('catalogSyncClient — declared boundaries and edge paths', () => {
  it('publishDomain declares unknown and already-shared domains', async () => {
    expect.hasAssertions();
    const host = await createHost([makeDomain('domain-1', 'Billing')]);
    await host.syncClient.start();
    host.timers.clear();

    const unknown = await host.syncClient.publishDomain('domain-ghost');
    expect(unknown).toStrictEqual({ published: false, reason: 'domain-not-found' });
    await host.syncClient.publishDomain('domain-1');
    const again = await host.syncClient.publishDomain('domain-1');
    expect(again).toStrictEqual({ published: false, reason: 'already-shared' });
    await host.syncClient.stop();
  });

  it('unpublishDomain declares a domain that is not shared', async () => {
    expect.hasAssertions();
    const host = await createHost([makeDomain('domain-1', 'Billing')]);
    await host.syncClient.start();
    host.timers.clear();
    const result = await host.syncClient.unpublishDomain('domain-1');
    expect(result).toStrictEqual({ unpublished: false, reason: 'not-shared' });
    await host.syncClient.stop();
  });

  it('resolveConflict declares unknown strategies and missing conflicts', async () => {
    expect.hasAssertions();
    const host = await createHost([makeDomain('domain-1', 'Billing')]);
    await host.syncClient.start();
    host.timers.clear();
    await expect(host.syncClient.resolveConflict('catalog-1', 'merge-magic'))
      .resolves.toStrictEqual({ resolved: false, reason: 'unknown-strategy' });
    await expect(host.syncClient.resolveConflict('catalog-1', 'take-server'))
      .resolves.toStrictEqual({ resolved: false, reason: 'no-conflict' });
    await host.syncClient.stop();
  });

  it('a conflict whose server record cannot be read back stays a push failure', async () => {
    expect.hasAssertions();
    const host = await createHost([makeDomain('domain-1', 'Billing')]);
    await host.syncClient.start();
    host.timers.clear();
    const { record } = await host.syncClient.publishDomain('domain-1');
    host.timers.clear();

    await host.transport.updateCatalog(record.id, {
      version: 1,
      design: { kind: 'domain-package', version: '2.0.0', domain: makeDomain('domain-1', 'Billing', [makeEntity('entity-2', 'Teammate')]) }
    });
    host.transport.script.readError = true;
    host.core.state.domains[0].entities.push(makeEntity('entity-3', 'Local'));
    await host.core.saveState();
    await host.flushTimers();

    // The 409 could not be enriched with the server version, so no conflict
    // entry is raised — the domain stays dirty for the next cycle instead.
    expect(host.syncClient.getConflicts()).toHaveLength(0);
    expect(host.transport.script.down).toBeUndefined();
    await host.syncClient.stop();
  });

  it('take-local on a tombstoned record restores it before writing', async () => {
    expect.hasAssertions();
    const host = await createHost([makeDomain('domain-1', 'Billing', [makeEntity('entity-1', 'Invoice')])]);
    await host.syncClient.start();
    host.timers.clear();
    const { record } = await host.syncClient.publishDomain('domain-1');
    host.timers.clear();

    host.core.state.domains[0].entities.push(makeEntity('entity-3', 'Local'));
    await host.core.saveState();
    host.timers.clear();
    await host.transport.deleteCatalog(record.id, 1);
    await host.syncClient.syncNow();
    expect(host.syncClient.getConflicts()[0]?.reason).toBe('deleted-remotely');

    const { resolved } = await host.syncClient.resolveConflict(record.id, 'take-local');
    expect(resolved).toBe(true);
    const remote = await host.transport.getCatalog(record.id);
    expect(remote.deletedAt).toBe('');
    expect(remote.design.domain.entities.map((entity: any) => entity.name)).toContain('Local');
    expect(host.core.state.domains[0].context.catalog.version).toBe(remote.version);
    await host.syncClient.stop();
  });

  it('take-server on a tombstoned record removes the local domain', async () => {
    expect.hasAssertions();
    const host = await createHost([makeDomain('domain-1', 'Billing', [makeEntity('entity-1', 'Invoice')])]);
    await host.syncClient.start();
    host.timers.clear();
    const { record } = await host.syncClient.publishDomain('domain-1');
    host.timers.clear();

    host.core.state.domains[0].entities.push(makeEntity('entity-3', 'Local'));
    await host.core.saveState();
    host.timers.clear();
    await host.transport.deleteCatalog(record.id, 1);
    await host.syncClient.syncNow();
    expect(host.syncClient.getConflicts()).toHaveLength(1);

    const { resolved } = await host.syncClient.resolveConflict(record.id, 'take-server');
    expect(resolved).toBe(true);
    expect(host.core.state.domains).toHaveLength(0);
    expect(host.syncClient.getConflicts()).toHaveLength(0);
    await host.syncClient.stop();
  });

  it('a bare (unwrapped) server design is admitted as the domain itself', async () => {
    expect.hasAssertions();
    const host = await createHost([]);
    await host.syncClient.start();
    host.timers.clear();
    await host.transport.createCatalog({
      name: 'Legacy',
      design: makeDomain('domain-legacy', 'Legacy', [makeEntity('entity-l', 'LegacyEntity')])
    });
    await host.syncClient.syncNow();
    expect(host.core.state.domains[0].name).toBe('Legacy');
    expect(host.core.state.domains[0].entities[0].name).toBe('LegacyEntity');
    await host.syncClient.stop();
  });

  it('start is idempotent and a concurrent syncNow is declared, never stacked', async () => {
    expect.hasAssertions();
    const host = await createHost([]);
    const first = await host.syncClient.start();
    expect(first.started).toBe(true);
    const second = await host.syncClient.start();
    expect(second).toStrictEqual({ started: true, already: true });

    const pending = host.syncClient.syncNow();
    const concurrent = await host.syncClient.syncNow();
    expect(concurrent).toStrictEqual({ synced: false, reason: 'already-syncing' });
    await pending;
    await host.syncClient.stop();
  });

  it('stop cancels pending cycles and unsubscribes the local listener', async () => {
    expect.hasAssertions();
    const host = await createHost([makeDomain('domain-1', 'Billing')]);
    await host.syncClient.start();
    await host.syncClient.publishDomain('domain-1');
    await host.syncClient.stop();
    host.timers.clear();

    host.core.state.domains[0].entities.push(makeEntity('entity-9', 'AfterStop'));
    await host.core.saveState();
    await host.flushTimers();
    const remote = await host.transport.getCatalog('catalog-1');
    expect(remote.version).toBe(1);
  });

  it('unpublishes a shared domain even if its context object was removed', async () => {
    expect.hasAssertions();
    const host = await createHost([makeDomain('domain-1', 'Billing')]);
    await host.syncClient.start();
    host.timers.clear();
    const { record } = await host.syncClient.publishDomain('domain-1');
    const marker = host.core.state.domains[0].context.catalog;
    delete host.core.state.domains[0].context;
    host.core.state.domains[0].context = { catalog: marker };

    await expect(host.syncClient.unpublishDomain('domain-1')).resolves.toStrictEqual({ unpublished: true });
    expect(host.core.state.domains[0].context.catalog).toBeUndefined();
    expect((await host.transport.getCatalog(record.id)).deletedAt).not.toBe('');
    await host.syncClient.stop();
  });
});

describe('catalogSyncClient — more declared edges', () => {
  it('a context-less server design is admitted (the marker stripper tolerates it)', async () => {
    expect.hasAssertions();
    const host = await createHost([]);
    await host.syncClient.start();
    host.timers.clear();
    await host.transport.createCatalog({
      name: 'Bare',
      design: { kind: 'domain-package', version: '2.0.0', domain: { id: 'domain-bare', name: 'Bare', entities: [] } }
    });
    await host.syncClient.syncNow();
    expect(host.core.state.domains[0].name).toBe('Bare');
    expect(host.core.state.domains[0].context.catalog.id).toBe('catalog-1');
    await host.syncClient.stop();
  });

  it('falls back to a Math.random identity when the runtime has no crypto.randomUUID', async () => {
    expect.hasAssertions();
    const ambient = globalThis.crypto;
    try {
      (globalThis as any).crypto = undefined;
      const host = await createHost([]);
      expect(host.syncClient.originId).toMatch(/^catalog-sync-/);
      await host.syncClient.stop();
    } finally {
      (globalThis as any).crypto = ambient;
    }
  });

  it('uses the ambient scheduler when none is injected', async () => {
    expect.hasAssertions();
    const backend: Backend = { records: new Map<string, string>() };
    const { client } = createCanaClientDouble(backend, 'host-ambient');
    const store = new CanaDesignerStore({ client });
    const transport = createCatalogTransportDouble();
    const notifications: Array<{ message: string; severity: string }> = [];
    const core: any = createDesignerState({
      store,
      seed: () => {
        core.state.domains = [makeDomain('domain-1', 'Billing')];
        core.state.selectedDomainId = 'domain-1';
        core.state.view = createDefaultView();
      },
      render: () => undefined
    });
    await core.loadState();
    // JUM-679: the debounce is driven, not waited out. This was the one test in
    // the file using real timers and a 40ms sleep, while every other test uses
    // the injected `schedule`/`cancelSchedule` pair the client already accepts.
    // A sleep long enough for a 5ms debounce on a quiet machine is a guess on a
    // loaded one.
    const timers: Map<number, { fn: () => unknown }> = new Map();
    let timerSeq = 0;
    const syncClient = createCatalogSyncClient({
      designerState: core,
      store,
      transport,
      notify: (message: string, severity: string) => notifications.push({ message, severity }),
      pushDebounceMs: 5,
      pollIntervalMs: 3600000,
      schedule: (fn: () => unknown) => {
        timerSeq += 1;
        timers.set(timerSeq, { fn });
        return timerSeq;
      },
      cancelSchedule: (handle: number) => { timers.delete(handle); }
    });
    await syncClient.start();
    await syncClient.publishDomain('domain-1');
    core.state.domains[0].entities.push(makeEntity('entity-1', 'Invoice'));
    await core.saveState();

    const pending = [...timers.values()];
    timers.clear();
    for (const timer of pending) {
      // eslint-disable-next-line no-await-in-loop
      await timer.fn();
    }

    const remote = await transport.getCatalog('catalog-1');
    expect(remote.version).toBe(2);
    syncClient.stop();
  });

  it('a failed push degrades the client and declares it — the edit stays durable', async () => {
    expect.hasAssertions();
    const host = await createHost([makeDomain('domain-1', 'Billing')]);
    await host.syncClient.start();
    host.timers.clear();
    await host.syncClient.publishDomain('domain-1');
    host.timers.clear();

    host.transport.script.writeError = true;
    host.core.state.domains[0].entities.push(makeEntity('entity-1', 'Invoice'));
    await host.core.saveState();
    await host.flushTimers();

    expect(host.syncClient.getStatus().degraded).toBe(true);
    expect(host.notifications.some((entry) => entry.severity === 'error'
      && entry.message.includes('Pushing to the shared catalog failed'))).toBe(true);
    expect(host.core.state.domains[0].entities).toHaveLength(1);
    await host.syncClient.stop();
  });

  it('take-local declares domain-not-found when the local domain is gone', async () => {
    expect.hasAssertions();
    const host = await createHost([makeDomain('domain-1', 'Billing')]);
    await host.syncClient.start();
    host.timers.clear();
    const { record } = await host.syncClient.publishDomain('domain-1');
    host.timers.clear();

    await host.transport.updateCatalog(record.id, {
      version: 1,
      design: { kind: 'domain-package', version: '2.0.0', domain: makeDomain('domain-1', 'Billing', [makeEntity('entity-2', 'Teammate')]) }
    });
    host.core.state.domains[0].entities.push(makeEntity('entity-3', 'Local'));
    await host.core.saveState();
    await host.flushTimers();
    expect(host.syncClient.getConflicts()).toHaveLength(1);

    host.core.state.domains = [];
    await expect(host.syncClient.resolveConflict(record.id, 'take-local'))
      .resolves.toStrictEqual({ resolved: false, reason: 'domain-not-found' });
    await host.syncClient.stop();
  });

  it('take-server resolves cleanly when the local domain is already gone', async () => {
    expect.hasAssertions();
    const host = await createHost([makeDomain('domain-1', 'Billing')]);
    await host.syncClient.start();
    host.timers.clear();
    const { record } = await host.syncClient.publishDomain('domain-1');
    host.timers.clear();

    await host.transport.updateCatalog(record.id, {
      version: 1,
      design: { kind: 'domain-package', version: '2.0.0', domain: makeDomain('domain-1', 'Billing', [makeEntity('entity-2', 'Teammate')]) }
    });
    host.core.state.domains[0].entities.push(makeEntity('entity-3', 'Local'));
    await host.core.saveState();
    await host.flushTimers();
    expect(host.syncClient.getConflicts()).toHaveLength(1);

    host.core.state.domains = [];
    const { resolved } = await host.syncClient.resolveConflict(record.id, 'take-server');
    expect(resolved).toBe(true);
    expect(host.syncClient.getConflicts()).toHaveLength(0);
    await host.syncClient.stop();
  });
});

describe('createCatalogHttpTransport — the HTTP mapping of the port', () => {
  it('requires a fetch implementation when the runtime has none', () => {
    expect.hasAssertions();
    const { createCatalogHttpTransport: createTransport } = require(
      path.join(repoRoot, 'apps', 'service-management', 'src', 'state', 'catalogSyncClient.js')
    );
    const ambient = globalThis.fetch;
    try {
      (globalThis as any).fetch = undefined;
      expect(() => createTransport({ baseUrl: 'http://x' }))
        .toThrow('createCatalogHttpTransport requires a fetch implementation.');
    } finally {
      (globalThis as any).fetch = ambient;
    }
    // With an ambient fetch (browsers, modern Node) no explicit injection is needed.
    expect(() => createTransport({ baseUrl: 'http://x' })).not.toThrow();
  });

  it('maps non-2xx responses to errors carrying status and parsed body', async () => {
    expect.hasAssertions();
    const { createCatalogHttpTransport: createTransport } = require(
      path.join(repoRoot, 'apps', 'service-management', 'src', 'state', 'catalogSyncClient.js')
    );
    const fetchImpl = async () => ({
      ok: false,
      status: 409,
      text: async () => JSON.stringify({
        message: 'Conflict - Stale catalog version',
        error: { metadata: { currentVersion: 3 } }
      })
    });
    const transport = createTransport({ baseUrl: 'http://backend', tokenProvider: () => 'Bearer t', fetchImpl });
    await expect(transport.updateCatalog('id-1', { version: 1 })).rejects.toMatchObject({
      status: 409,
      body: { message: 'Conflict - Stale catalog version' }
    });
  });

  it('sends the token and JSON body, and returns the list result array', async () => {
    expect.hasAssertions();
    const { createCatalogHttpTransport: createTransport } = require(
      path.join(repoRoot, 'apps', 'service-management', 'src', 'state', 'catalogSyncClient.js')
    );
    const calls: any[] = [];
    const fetchImpl = async (url: string, init: any) => {
      calls.push({ url, init });
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ result: [{ id: 'catalog-1', version: 1 }], total: 1 })
      };
    };
    const transport = createTransport({ baseUrl: 'http://backend/', tokenProvider: () => 'Bearer t', fetchImpl });
    const records = await transport.listCatalogs({ includeDeleted: true });
    expect(records).toHaveLength(1);
    expect(calls[0].url).toBe('http://backend/api/1.0.0/catalogs?page=1&size=500&includeDeleted=true');
    expect(calls[0].init.headers.Authorization).toBe('Bearer t');

    await transport.restoreCatalog('catalog-1', 2);
    expect(calls[1].url).toBe('http://backend/api/1.0.0/catalogs/catalog-1/restore');
    expect(calls[1].init.method).toBe('POST');
    expect(JSON.parse(calls[1].init.body)).toStrictEqual({ version: 2 });
  });

  it('tolerates an unparseable response body as null', async () => {
    expect.hasAssertions();
    const { createCatalogHttpTransport: createTransport } = require(
      path.join(repoRoot, 'apps', 'service-management', 'src', 'state', 'catalogSyncClient.js')
    );
    const fetchImpl = async () => ({ ok: true, status: 200, text: async () => '<html>oops</html>' });
    const transport = createTransport({ baseUrl: 'http://backend', fetchImpl });
    await expect(transport.getCatalog('id-1')).resolves.toBeNull();
  });

  it('maps every remaining verb to its route and encodes path parameters', async () => {
    expect.hasAssertions();
    const { createCatalogHttpTransport: createTransport } = require(
      path.join(repoRoot, 'apps', 'service-management', 'src', 'state', 'catalogSyncClient.js')
    );
    const calls: any[] = [];
    const fetchImpl = async (url: string, init: any) => {
      calls.push({ url, init });
      return { ok: true, status: 200, text: async () => JSON.stringify({ id: 'x' }) };
    };
    const transport = createTransport({ baseUrl: 'http://backend', fetchImpl });
    await transport.getCatalog('id with spaces');
    await transport.createCatalog({ name: 'Billing', design: {} });
    await transport.updateCatalog('id-1', { version: 1, design: {} });
    await transport.deleteCatalog('id-1', 3);
    expect(calls[0].url).toBe('http://backend/api/1.0.0/catalogs/id%20with%20spaces');
    expect(calls[0].init.method).toBe('GET');
    expect(calls[1].url).toBe('http://backend/api/1.0.0/catalogs');
    expect(calls[1].init.method).toBe('POST');
    expect(calls[2].init.method).toBe('PUT');
    expect(JSON.parse(calls[2].init.body)).toStrictEqual({ version: 1, design: {} });
    expect(calls[3].url).toBe('http://backend/api/1.0.0/catalogs/id-1?version=3');
    expect(calls[3].init.method).toBe('DELETE');
  });

  it('a corrupt server record degrades into a normalized placeholder, never a crash', async () => {
    expect.hasAssertions();
    const host = await createHost([]);
    await host.syncClient.start();
    host.timers.clear();
    await host.transport.createCatalog({ name: 'Corrupt', design: 42 });
    const result = await host.syncClient.syncNow();
    expect(result.synced).toBe(true);
    expect(host.core.state.domains).toHaveLength(1);
    expect(host.core.state.domains[0].name).toBe('Domain_1');
    await host.syncClient.stop();
  });

  it('a tombstoned record the host never had stays unadmitted', async () => {
    expect.hasAssertions();
    const host = await createHost([]);
    const created = await host.transport.createCatalog({
      name: 'Gone',
      design: { kind: 'domain-package', version: '2.0.0', domain: makeDomain('domain-g', 'Gone') }
    });
    await host.transport.deleteCatalog(created.id, 1);
    await host.syncClient.start();
    expect(host.core.state.domains).toHaveLength(0);
    await host.syncClient.stop();
  });

  it('a read-back with nothing newer is declared already-current', async () => {
    expect.hasAssertions();
    const host = await createHost([makeDomain('domain-1', 'Billing')]);
    await host.syncClient.start();
    host.timers.clear();
    await host.syncClient.publishDomain('domain-1');
    host.timers.clear();
    const result = await host.syncClient.syncNow();
    expect(result.synced).toBe(true);
    expect(result.pulled).toStrictEqual({ pulled: false, reason: 'already-current' });
    await host.syncClient.stop();
  });

  it('syncNow reports how many domains it pushed', async () => {
    expect.hasAssertions();
    const host = await createHost([makeDomain('domain-1', 'Billing')]);
    await host.syncClient.start();
    host.timers.clear();
    await host.syncClient.publishDomain('domain-1');
    host.timers.clear();
    host.core.state.domains[0].entities.push(makeEntity('entity-1', 'Invoice'));
    await host.core.saveState();
    const result = await host.syncClient.syncNow();
    expect(result.synced).toBe(true);
    expect(result.pushed).toBe(1);
    await host.syncClient.stop();
  });

  it('foreign and cleared local events never schedule a push', async () => {
    expect.hasAssertions();
    const host = await createHost([makeDomain('domain-1', 'Billing')]);
    await host.syncClient.start();
    host.timers.clear();
    await host.syncClient.publishDomain('domain-1');
    host.timers.clear();

    host.syncClient.onLocalCommit(null);
    host.syncClient.onLocalCommit({ store: 'other-store', key: STATE_KEY, type: 'updated' });
    host.syncClient.onLocalCommit({ store: STORE_NAME, key: 'other-key', type: 'updated' });
    host.syncClient.onLocalCommit({ store: STORE_NAME, key: STATE_KEY, type: 'cleared' });
    expect(host.timers.size).toBe(0);
    await host.syncClient.stop();
  });
});

describe('catalogSyncClient — partition and convergence', () => {
  it('a partition is declared (never silent) and the client converges after healing', async () => {
    expect.hasAssertions();
    const host = await createHost([makeDomain('domain-1', 'Billing', [makeEntity('entity-1', 'Invoice')])]);
    await host.syncClient.start();
    host.timers.clear();
    const { record } = await host.syncClient.publishDomain('domain-1');
    host.timers.clear();

    host.transport.script.down = true;
    const partitioned = await host.syncClient.syncNow();
    expect(partitioned.synced).toBe(false);
    expect(partitioned.reason).toBe('transport-unavailable');
    expect(host.syncClient.getStatus().degraded).toBe(true);
    expect(host.notifications.some((entry) => entry.severity === 'error' && entry.message.includes('unreachable'))).toBe(true);

    // The user keeps working through the partition; the local edit is durable.
    host.core.state.domains[0].entities.push(makeEntity('entity-4', 'PartitionEntity'));
    await host.core.saveState();
    // A teammate also edits the shared catalog during the partition — over
    // their own, working connection (the double's guard scripts THIS host's).
    host.transport.script.down = false;
    await host.transport.createCatalog({
      name: 'Catalog',
      design: { kind: 'domain-package', version: '2.0.0', domain: makeDomain('domain-remote-2', 'Catalog', [makeEntity('entity-8', 'Product')]) }
    });
    await host.transport.updateCatalog(record.id, {
      version: 1,
      design: { kind: 'domain-package', version: '2.0.0', domain: makeDomain('domain-1', 'Billing', [makeEntity('entity-9', 'TeammateEntity')]) }
    });
    host.transport.script.down = true;

    // The partition heals: the client converges by read-back on the next cycle.
    host.transport.script.down = false;
    const healed = await host.syncClient.syncNow();
    expect(healed.synced).toBe(true);
    expect(host.syncClient.getStatus().degraded).toBe(false);
    // The teammate's new record converged into the local document...
    expect(host.core.state.domains.map((domain: any) => domain.name)).toContain('Catalog');
    // ...and the partitioned local edit surfaced as a reviewable conflict,
    // not a lost write.
    const conflicts = host.syncClient.getConflicts();
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].catalogId).toBe(record.id);
    const billing = host.core.state.domains.find((domain: any) => domain.name === 'Billing');
    expect(billing.entities.map((entity: any) => entity.name)).toContain('PartitionEntity');
    await host.syncClient.stop();
  });

  it('the poll loop retries on its own once the scheduler fires again', async () => {
    expect.hasAssertions();
    const host = await createHost([]);
    await host.syncClient.start();
    expect(host.syncClient.getStatus().lastSyncAt).not.toBeNull();

    host.transport.script.down = true;
    await host.flushTimers();
    expect(host.syncClient.getStatus().degraded).toBe(true);

    host.transport.script.down = false;
    await teammateWritesDomain(host.transport, makeDomain('domain-late', 'LateDomain'));
    await host.flushTimers();

    expect(host.syncClient.getStatus().degraded).toBe(false);
    expect(host.core.state.domains.map((domain: any) => domain.name)).toContain('LateDomain');
    await host.syncClient.stop();
  });

  it('unpublishDomain tombstones the remote record and keeps the domain local', async () => {
    expect.hasAssertions();
    const host = await createHost([makeDomain('domain-1', 'Billing')]);
    await host.syncClient.start();
    host.timers.clear();
    const { record } = await host.syncClient.publishDomain('domain-1');
    host.timers.clear();

    const { unpublished } = await host.syncClient.unpublishDomain('domain-1');
    expect(unpublished).toBe(true);
    expect(host.core.state.domains[0].context.catalog).toBeUndefined();
    const remote = await host.transport.getCatalog(record.id);
    expect(remote.deletedAt).not.toBe('');
    expect(host.syncClient.getStatus().sharedCount).toBe(0);
    await host.syncClient.stop();
  });

  it('exposes the default tuning constants', () => {
    expect.hasAssertions();
    expect(CATALOG_SYNC_POLL_INTERVAL_MS).toBe(15000);
    expect(CATALOG_SYNC_PUSH_DEBOUNCE_MS).toBe(300);
  });
});
