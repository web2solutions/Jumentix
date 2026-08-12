/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable jest/prefer-expect-assertions, jest/max-expects, jest/no-conditional-in-test */
import path from 'node:path';
import { until } from '@test/helpers/until';

/**
 * Unit suite for the multi-tab write-event sync engine (JUM-485),
 * `apps/service-management/src/state/designerSync.js`.
 *
 * What is real here and what is a double, and why (Requirements 109/115):
 *
 * - The sync engine, the `createDesignerState` core and the
 *   `CanaDesignerStore` port adapter are all REAL — the convergence, undo
 *   isolation, selection reconciliation and unknown-outcome paths asserted
 *   here run over the production code, end to end.
 * - The Cana client is a Jumentix-owned contract (packages/cana): the declared
 *   in-memory double below reproduces its ordered-listener semantics —
 *   per-client event publication after commit, cursor-ordered retained
 *   window, `sinceCursor` replay and the `'NotFound'` resume failure — built
 *   with the REAL `canaError` constructor, because two browser tabs each hold
 *   their own client instance and this suite drives two of them.
 * - The cross-tab transport is a declared in-process FAKE MEDIATOR: a hub
 *   whose channels fan each message out to every other channel, mirroring
 *   BroadcastChannel semantics (no self-delivery) without a browser. The
 *   two-page real-browser proof lives in
 *   `test/integration/ServiceManagement/multiTabSync.browser.integration.test.ts`.
 *
 * The suite also records JUM-485's three mandated design answers as
 * executable behaviour: undo is local-only (remote changes are not undoable
 * and truncate the redo branch), a pending local edit keeps its unsaved
 * surface (view/tab/focus) while the committed document wins, and a remote
 * delete can never leave a dangling selection.
 */

const repoRoot = path.resolve(__dirname, '../../../../..');
const {
  createDesignerState,
  createDefaultView,
  normalizeStatePayload
} = require('@jumentix/designer-core/state/designerState.js');

const {
  DESIGNER_SYNC_CHANNEL_NAME,
  DESIGNER_SYNC_CURSOR_KEY,
  applyRemoteDocument,
  createDesignerSync,
  reconcileSelection
} = require(path.join(repoRoot, 'apps', 'service-management', 'src', 'state', 'designerSync.js'));
const {
  CanaDesignerStore
} = require(path.join(repoRoot, 'apps', 'service-management', 'src', 'store', 'CanaDesignerStore.js'));
const {
  canaError
  // The REAL Cana module (jest maps `@jumentix/cana` to packages/cana/src).
  // eslint-disable-next-line import/no-unresolved
} = require('@jumentix/cana');

const STATE_KEY = 'service-management.v1';
const STORE_NAME = 'designerDocuments';

function createFakeStorage(initial: Record<string, string> = {}) {
  const map = new Map<string, string>(Object.entries(initial));
  return {
    getItem: (key: string) => (map.has(key) ? (map.get(key) as string) : null),
    setItem: (key: string, value: string) => { map.set(key, String(value)); },
    removeItem: (key: string) => { map.delete(key); },
    map
  };
}

/**
 * Declared in-process fake mediator: BroadcastChannel semantics (every
 * message fans out to every OTHER open channel) with no browser.
 */
function createFakeMediatorHub() {
  const channels = new Set<any>();
  return {
    channels,
    createChannel() {
      const channel: any = {
        onmessage: null,
        posted: [] as any[],
        closed: false,
        postMessage(message: unknown) {
          channel.posted.push(message);
          channels.forEach((peer) => {
            if (peer !== channel && !peer.closed && typeof peer.onmessage === 'function') {
              peer.onmessage({ data: message });
            }
          });
        },
        close() {
          channel.closed = true;
          channels.delete(channel);
        }
      };
      channels.add(channel);
      return channel;
    }
  };
}

type Backend = { records: Map<string, string> };

/**
 * Declared in-memory double of the Cana client's ordered-listener contract
 * (Cana JUM-413): events publish to THIS client's listeners only, after a
 * committed transaction, in cursor order; `subscribe(listener, {sinceCursor})`
 * replays retained events newer than the cursor and throws a real `'NotFound'`
 * CanaError when the retained window no longer covers it.
 */
function createCanaSyncClientDouble(backend: Backend, clientId: string) {
  const listeners = new Set<(event: any) => void>();
  const retained: any[] = [];
  let cursor = 0;
  let txSeq = 0;
  const script: {
    transactionOutcome?: 'committed' | 'unknown';
    applyOnUnknown?: boolean;
    openError?: unknown;
    readError?: unknown;
  } = {};
  const client = {
    async open() {
      if (script.openError !== undefined) throw script.openError;
    },
    table(name: string) {
      return {
        name,
        async get(key: string) {
          if (script.readError !== undefined) throw script.readError;
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
      const outcome = script.transactionOutcome ?? 'committed';
      txSeq += 1;
      const correlationId = `${clientId}:${txSeq}`;
      const attemptedAt = 1722000000000 + txSeq;
      // Cana publishes only committed events; `applyOnUnknown` scripts the
      // torn-down write that committed anyway (the case read-back confirms).
      if (outcome === 'committed' || script.applyOnUnknown === true) {
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
            correlationId,
            at: attemptedAt,
            originId: clientId
          };
          retained.push(event);
          listeners.forEach((listener) => listener(event));
        });
      }
      return {
        outcome, result, events: [], correlationId, attemptedAt
      };
    },
    subscribe(listener: (event: any) => void, options?: { sinceCursor?: number }) {
      const since = options?.sinceCursor;
      if (since !== undefined && since !== null) {
        const oldest = retained.length > 0 ? retained[0].cursor : 0;
        if (since < oldest - 1) {
          throw canaError('NotFound', 'The requested cursor predates the retained event window; reload from the database.');
        }
        retained.filter((event) => event.cursor > since).forEach(listener);
      }
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    async storageState() {
      return { persistent: true, nearQuota: false, evicted: false };
    }
  };
  return {
    client, script, retained, listeners
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

function makeDocument(overrides: Record<string, unknown> = {}) {
  const domains = (overrides.domains as any[]) ?? [makeDomain('domain-1', 'Billing', [makeEntity('entity-1', 'Invoice')])];
  return {
    domains,
    relationships: [],
    selectedDomainId: domains[0]?.id ?? null,
    selectedEntityId: null,
    selectedRelationshipId: null,
    idCounter: 10,
    activeTab: 'domain-designer',
    interfaces: [],
    serviceConfiguration: { serviceKind: 'rest-api' },
    runtimeEnvironment: { environment: 'dev', fileName: '.env.dev', values: {} },
    deployments: [],
    view: { zoom: 1 },
    ...overrides
  };
}

let clientSeq = 0; // eslint-disable-line jest/require-hook

/**
 * A full designer tab: real store + real state core + real sync engine, over
 * the shared backend and the fake mediator, with a manually-flushed scheduler
 * so the coalescing window is deterministic.
 */
function createTab(backend: Backend, hub: ReturnType<typeof createFakeMediatorHub>, options: {
  noChannel?: boolean;
  channel?: unknown;
  cursorStorage?: ReturnType<typeof createFakeStorage>;
  seedDocument?: Record<string, unknown>;
} = {}) {
  clientSeq += 1;
  const clientId = `client-${clientSeq}`;
  const {
    client, script, retained, listeners
  } = createCanaSyncClientDouble(backend, clientId);
  const store = new CanaDesignerStore({ client });
  const renders: string[] = [];
  const notifications: Array<{ message: string; severity: string }> = [];
  const saveOutcomes: Array<Promise<unknown>> = [];
  const timers: Map<number, () => void> = new Map();
  let timerSeq = 0;
  let core: any;
  const seed = () => {
    const document: any = options.seedDocument ?? makeDocument();
    core.state.domains = JSON.parse(JSON.stringify(document.domains));
    core.state.relationships = JSON.parse(JSON.stringify(document.relationships));
    core.state.selectedDomainId = document.selectedDomainId ?? document.domains[0]?.id ?? null;
    core.state.selectedEntityId = null;
    core.state.selectedRelationshipId = null;
    core.state.idCounter = 2;
    core.state.view = createDefaultView();
  };
  let sync: any = null;
  core = createDesignerState({
    store,
    seed,
    render: () => renders.push('core-render'),
    onSaveResult: (result: unknown, payload: unknown) => {
      if (sync) saveOutcomes.push(Promise.resolve(sync.reportSaveOutcome(result, payload)));
    }
  });
  sync = createDesignerSync({
    store,
    designerState: core,
    render: () => renders.push('sync-render'),
    notify: (message: string, severity: string) => notifications.push({ message, severity }),
    channel: options.noChannel ? null : (options.channel ?? hub.createChannel()),
    originId: `${clientId}-tab`,
    cursorStorage: options.cursorStorage ?? createFakeStorage(),
    schedule: (fn: () => void) => {
      timerSeq += 1;
      timers.set(timerSeq, fn);
      return timerSeq;
    },
    cancelSchedule: (handle: number) => { timers.delete(handle); },
    coalesceWindowMs: 5
  });
  const flush = () => {
    const due = [...timers.values()];
    timers.clear();
    due.forEach((fn) => fn());
  };
  return {
    backend,
    hub,
    client,
    clientId,
    script,
    retained,
    listeners,
    store,
    core,
    sync,
    renders,
    notifications,
    saveOutcomes,
    timers,
    flush
  };
}

/**
 * Flush the async save→commit→publish→broadcast chain: `withPersist` is
 * synchronous but the Cana write behind it is not, and the channel message
 * only exists once the transaction published. `setImmediate` drains the full
 * microtask chain without depending on its exact depth.
 */
function lastItem<T>(items: T[]): T {
  const item = items[items.length - 1];
  if (item === undefined) throw new Error('expected at least one item');
  return item;
}

function lastNotification(tab: any): { message: string; severity: string } {
  return lastItem(tab.notifications as Array<{ message: string; severity: string }>);
}

async function flushAsync() {
  await new Promise((resolve) => { setImmediate(resolve); });
  await new Promise((resolve) => { setImmediate(resolve); });
}

/** Perform a local edit and wait for its committed event to broadcast. */
async function edit(tab: any, action: () => void) {
  tab.core.withPersist(action);
  await flushAsync();
}

describe('designerSync — two-tab convergence over a shared mediator (JUM-485)', () => {
  it('converges both tabs on the same state after a write in one tab', async () => {
    const backend: Backend = { records: new Map() };
    const hub = createFakeMediatorHub();
    const tabA = createTab(backend, hub);
    const tabB = createTab(backend, hub);
    await tabA.core.loadState();
    await tabB.core.loadState();
    expect((await tabA.sync.start()).started).toBe(true);
    expect((await tabB.sync.start()).started).toBe(true);

    await edit(tabA, () => {
      tabA.core.state.domains = [
        ...tabA.core.state.domains,
        makeDomain('domain-2', 'Shipping', [makeEntity('entity-2', 'Shipment')])
      ];
    });
    tabB.flush();

    expect(tabB.core.state.domains.map((domain: any) => domain.id)).toStrictEqual(['domain-1', 'domain-2']);
    // Convergence is on the NORMALISED document: the remote apply normalises
    // exactly as loadState does, so compare against A's document normalised
    // by the same function.
    const normalizedA = normalizeStatePayload({
      domains: tabA.core.state.domains,
      relationships: tabA.core.state.relationships
    });
    expect(tabB.core.state.domains).toStrictEqual(normalizedA.domains);
    expect(tabB.renders).toStrictEqual(['sync-render']);
    expect(lastNotification(tabB).message).toContain('change from another tab');
    expect(lastNotification(tabB).severity).toBe('info');
    // The broadcast carried this tab's origin identity and Cana's cursor.
    const channelA = [...hub.channels].find((channel) => channel.posted.length > 0);
    expect(channelA.posted[0]!.originId).toBe(tabA.sync.originId);
    // The boot seed save was cursor 1 on A's client; this write is cursor 2.
    expect(channelA.posted[0]!.cursor).toBe(2);
    // And the converse direction converges too.
    await edit(tabB, () => {
      tabB.core.state.relationships = [{
        id: 'rel-1', fromEntityId: 'entity-1', toEntityId: 'entity-2', name: 'bills'
      }];
    });
    tabA.flush();
    const normalizedB = normalizeStatePayload({
      domains: tabB.core.state.domains,
      relationships: tabB.core.state.relationships
    });
    expect(tabA.core.state.relationships).toStrictEqual(normalizedB.relationships);
  });

  it('attributes events by origin: a tab never applies its own echo', async () => {
    const backend: Backend = { records: new Map() };
    const hub = createFakeMediatorHub();
    const tab = createTab(backend, hub);
    await tab.core.loadState();
    await tab.sync.start();

    tab.sync.onChannelMessage({
      originId: tab.sync.originId,
      record: JSON.stringify(makeDocument({ domains: [] }))
    });
    expect(tab.timers.size).toBe(0);
    expect(tab.renders).toStrictEqual([]);
  });

  it('re-publishes only state-document events; baseline writes and foreign stores stay local', async () => {
    const backend: Backend = { records: new Map() };
    const hub = createFakeMediatorHub();
    const tab = createTab(backend, hub);
    const peer = createTab(backend, hub);
    await tab.sync.start();
    await peer.sync.start();

    tab.sync.onLocalEvent({ store: 'otherStore', key: STATE_KEY, record: '{}' });
    tab.sync.onLocalEvent({ store: STORE_NAME, key: 'service-management.schema-baseline.v1', record: '{}' });
    expect(peer.timers.size).toBe(0);
    // A cursor-less event for the state document still broadcasts (no persist).
    tab.sync.onLocalEvent({
      store: STORE_NAME,
      key: STATE_KEY,
      record: JSON.stringify(makeDocument())
    });
    expect(peer.timers.size).toBe(1);
    expect(tab.sync.getLastCursor()).toBeNull();
  });

  it('wires channels that expose addEventListener instead of onmessage', async () => {
    const backend: Backend = { records: new Map() };
    const hub = createFakeMediatorHub();
    const eventTargetChannel: any = {
      listener: null,
      addEventListener(type: string, fn: (event: any) => void) {
        if (type === 'message') eventTargetChannel.listener = fn;
      },
      postMessage: () => undefined,
      close: () => undefined
    };
    const tab = createTab(backend, hub, { channel: eventTargetChannel });
    await tab.core.loadState();
    expect((await tab.sync.start()).channelAvailable).toBe(true);
    eventTargetChannel.listener({ data: { originId: 'remote-tab', record: JSON.stringify(makeDocument({ domains: [] })) } });
    tab.flush();
    expect(tab.core.state.domains).toStrictEqual([]);
  });
});

describe('designerSync — undo is local-only and remote changes are not undoable (question 1)', () => {
  it('a remote apply is never recorded on the undo stack', async () => {
    const backend: Backend = { records: new Map() };
    const hub = createFakeMediatorHub();
    const tabA = createTab(backend, hub);
    const tabB = createTab(backend, hub);
    await tabA.core.loadState();
    await tabB.core.loadState();
    await tabA.sync.start();
    await tabB.sync.start();

    tabB.core.withPersist(() => {
      tabB.core.state.domains[0].name = 'Billing v2';
    });
    tabB.flush();
    const pastAfterLocalEdit = tabB.core.history.past.length;

    await edit(tabA, () => {
      tabA.core.state.domains = [
        ...tabA.core.state.domains,
        makeDomain('domain-9', 'RemoteDomain')
      ];
    });
    tabB.flush();

    // The remote change applied to the model but the undo stack grew by zero:
    // there is nothing remote to undo.
    expect(tabB.core.state.domains.some((domain: any) => domain.id === 'domain-9')).toBe(true);
    expect(tabB.core.history.past).toHaveLength(pastAfterLocalEdit);
  });

  it('undoing a local action after a remote change restores the local snapshot as a new local write', async () => {
    const backend: Backend = { records: new Map() };
    const hub = createFakeMediatorHub();
    const tabA = createTab(backend, hub);
    const tabB = createTab(backend, hub);
    await tabA.core.loadState();
    await tabB.core.loadState();
    await tabA.sync.start();
    await tabB.sync.start();

    tabB.core.withPersist(() => {
      tabB.core.state.domains[0].name = 'Billing v2';
    });
    tabB.flush();
    await edit(tabA, () => {
      tabA.core.state.domains[0].name = 'Remote rename';
    });
    tabB.flush();
    expect(tabB.core.state.domains[0].name).toBe('Remote rename');

    // Undo restores B's OWN prior snapshot (question 1: undo is local-only);
    // restoring it persists and broadcasts like any local edit —
    // whole-document last-writer-wins, never an undo OF the remote change.
    const rendersBefore = tabB.renders.length;
    tabB.core.undo();
    expect(tabB.core.state.domains[0].name).toBe('Billing');
    expect(tabB.renders).toHaveLength(rendersBefore + 1);
    await flushAsync();
    tabA.flush();
    expect(tabA.core.state.domains[0].name).toBe('Billing');
  });

  it('a remote change truncates the redo branch rather than replaying into a state that no longer exists', async () => {
    const backend: Backend = { records: new Map() };
    const hub = createFakeMediatorHub();
    const tabA = createTab(backend, hub);
    const tabB = createTab(backend, hub);
    await tabA.core.loadState();
    await tabB.core.loadState();
    await tabA.sync.start();
    await tabB.sync.start();

    tabB.core.withPersist(() => {
      tabB.core.state.domains[0].name = 'Billing v2';
    });
    tabB.core.undo();
    expect(tabB.core.history.future).toHaveLength(1);

    await edit(tabA, () => {
      tabA.core.state.domains[0].name = 'Remote rename';
    });
    tabB.flush();
    expect(tabB.core.history.future).toStrictEqual([]);
    tabB.core.redo();
    expect(tabB.core.state.domains[0].name).toBe('Remote rename');
  });
});

describe('designerSync — pending local edits keep their unsaved surface (question 2)', () => {
  it('a remote apply replaces the model but never imports the remote view, tab or selection', async () => {
    const backend: Backend = { records: new Map() };
    const hub = createFakeMediatorHub();
    const tabA = createTab(backend, hub);
    const tabB = createTab(backend, hub);
    await tabA.core.loadState();
    await tabB.core.loadState();
    await tabA.sync.start();
    await tabB.sync.start();

    // B's in-flight interaction surface: zoomed in, on another tab, entity selected.
    tabB.core.state.view = { ...createDefaultView(), zoom: 2 };
    tabB.core.state.activeTab = 'service-config';
    tabB.core.state.selectedEntityId = 'entity-1';

    await edit(tabA, () => {
      tabA.core.state.domains[0].name = 'Remote rename';
      tabA.core.state.view = { ...createDefaultView(), zoom: 0.5 };
      tabA.core.state.activeTab = 'deploy-management';
      tabA.core.state.selectedEntityId = null;
    });
    tabB.flush();

    expect(tabB.core.state.domains[0].name).toBe('Remote rename');
    expect(tabB.core.state.view.zoom).toBe(2);
    expect(tabB.core.state.activeTab).toBe('service-config');
    expect(tabB.core.state.selectedEntityId).toBe('entity-1');
  });
});

describe('designerSync — selection reconciliation on remote deletes (question 3)', () => {
  async function bootPair() {
    const backend: Backend = { records: new Map() };
    const hub = createFakeMediatorHub();
    const tabA = createTab(backend, hub);
    const tabB = createTab(backend, hub);
    await tabA.core.loadState();
    await tabB.core.loadState();
    await tabA.sync.start();
    await tabB.sync.start();
    return { tabA, tabB };
  }

  it('a remote delete of the selected entity clears the selection and announces it', async () => {
    const { tabA, tabB } = await bootPair();
    tabB.core.state.selectedEntityId = 'entity-1';
    await edit(tabA, () => {
      tabA.core.state.domains = [makeDomain('domain-1', 'Billing', [])];
    });
    tabB.flush();
    expect(tabB.core.state.selectedEntityId).toBeNull();
    expect(lastNotification(tabB).message).toContain('selected entity was deleted remotely');
  });

  it('a remote delete of the selected relationship clears the selection', async () => {
    const { tabA, tabB } = await bootPair();
    tabB.core.withPersist(() => {
      tabB.core.state.relationships = [{
        id: 'rel-1', fromEntityId: 'entity-1', toEntityId: 'entity-1', name: 'self'
      }];
      tabB.core.state.selectedRelationshipId = 'rel-1';
    });
    tabB.flush();
    expect(tabB.core.state.selectedRelationshipId).toBe('rel-1');
    await edit(tabA, () => {
      tabA.core.state.relationships = [];
    });
    tabB.flush();
    expect(tabB.core.state.selectedRelationshipId).toBeNull();
    expect(lastNotification(tabB).message).toContain('selected relationship was deleted remotely');
  });

  it('a remote delete of the selected domain moves the selection to the first remaining domain', async () => {
    const { tabA, tabB } = await bootPair();
    await edit(tabA, () => {
      tabA.core.state.domains = [
        ...tabA.core.state.domains,
        makeDomain('domain-2', 'Shipping')
      ];
    });
    tabB.flush();
    tabB.core.state.selectedDomainId = 'domain-2';
    await edit(tabA, () => {
      tabA.core.state.domains = tabA.core.state.domains.filter((domain: any) => domain.id !== 'domain-2');
    });
    tabB.flush();
    expect(tabB.core.state.selectedDomainId).toBe('domain-1');
    expect(lastNotification(tabB).message).toContain('selected domain was deleted remotely');
  });

  it('reconcileSelection leaves a valid selection untouched and accepts an empty model', () => {
    const state = {
      domains: [makeDomain('domain-1', 'Billing', [makeEntity('entity-1', 'Invoice')])],
      relationships: [],
      selectedDomainId: 'domain-1',
      selectedEntityId: 'entity-1',
      selectedRelationshipId: null
    };
    expect(reconcileSelection(state)).toStrictEqual([]);
    expect(state.selectedDomainId).toBe('domain-1');
    const empty = {
      domains: [], relationships: [], selectedDomainId: 'domain-9', selectedEntityId: null, selectedRelationshipId: null
    };
    expect(reconcileSelection(empty)).toStrictEqual(['domain']);
    expect(empty.selectedDomainId).toBeNull();
  });
});

describe('designerSync — event storms coalesce into bounded re-render work', () => {
  it('a burst of remote writes applies the latest document once, with the count announced', async () => {
    const backend: Backend = { records: new Map() };
    const hub = createFakeMediatorHub();
    const tabA = createTab(backend, hub);
    const tabB = createTab(backend, hub);
    await tabA.core.loadState();
    await tabB.core.loadState();
    await tabA.sync.start();
    await tabB.sync.start();

    for (let index = 0; index < 5; index += 1) {
      // eslint-disable-next-line no-await-in-loop
      await edit(tabA, () => {
        tabA.core.state.domains[0].name = `Bulk rename ${index}`;
      });
    }
    expect(tabB.timers.size).toBe(1);
    tabB.flush();

    const syncRenders = tabB.renders.filter((kind) => kind === 'sync-render');
    expect(syncRenders).toHaveLength(1);
    expect(tabB.core.state.domains[0].name).toBe('Bulk rename 4');
    expect(lastNotification(tabB).message).toContain('5 changes from another tab');
  });
});

describe('designerSync — durable cursor, resume and closed-tab recovery (Cana JUM-413)', () => {
  it('persists the cursor of every observed local event', async () => {
    const backend: Backend = { records: new Map() };
    const hub = createFakeMediatorHub();
    const cursorStorage = createFakeStorage();
    const tab = createTab(backend, hub, { cursorStorage });
    await tab.core.loadState();
    await tab.sync.start();
    await edit(tab, () => {
      tab.core.state.domains[0].name = 'Renamed';
    });
    // The boot seed save was this client's cursor 1; the edit is cursor 2.
    expect(tab.sync.getLastCursor()).toBe(2);
    expect(cursorStorage.getItem(DESIGNER_SYNC_CURSOR_KEY)).toBe('2');
  });

  it('resumes the subscription from the persisted cursor and replays what the window retained', async () => {
    const backend: Backend = { records: new Map() };
    const hub = createFakeMediatorHub();
    const cursorStorage = createFakeStorage();
    const first = createTab(backend, hub, { cursorStorage });
    await first.core.loadState();
    await first.sync.start();
    // The boot seed save is cursor 1; two committed writes are cursors 2
    // and 3 in this client's retained window, and the persisted cursor is 3.
    await edit(first, () => {
      first.core.state.domains[0].name = 'First session edit';
    });
    await edit(first, () => {
      first.core.state.domains[0].name = 'Second session edit';
    });
    // Rewind the cursor as a resubscribing tab would have persisted it before
    // the second write, then stop the first subscription.
    cursorStorage.setItem(DESIGNER_SYNC_CURSOR_KEY, '2');
    first.sync.stop();

    // In-session resubscription (same client, retained window intact): the
    // replay delivers the missed event (cursor 2) BEFORE subscribe returns.
    const secondChannel = hub.createChannel();
    const second = createDesignerSync({
      store: first.store,
      designerState: first.core,
      channel: secondChannel,
      cursorStorage,
      originId: 'second-tab',
      notify: () => undefined,
      render: () => undefined
    });
    expect((await second.start()).started).toBe(true);
    expect(second.getLastCursor()).toBe(3);
    expect(cursorStorage.getItem(DESIGNER_SYNC_CURSOR_KEY)).toBe('3');
    // The replayed local event is re-published on the second tab's channel.
    expect(secondChannel.posted).toHaveLength(1);
    expect(secondChannel.posted[0]!.cursor).toBe(3);
    second.stop();
  });

  it('a cursor the retained window no longer covers resyncs from the document, then subscribes fresh', async () => {
    const backend: Backend = { records: new Map() };
    backend.records.set(STATE_KEY, JSON.stringify(makeDocument({ domains: [makeDomain('domain-7', 'Recovered')] })));
    const hub = createFakeMediatorHub();
    const tab = createTab(backend, hub, { cursorStorage: createFakeStorage({ [DESIGNER_SYNC_CURSOR_KEY]: '2' }) });
    // The client's window starts at cursor 10 — the persisted cursor 2 is gone.
    tab.retained.push({
      type: 'updated',
      store: STORE_NAME,
      key: STATE_KEY,
      record: '{}',
      cursor: 10,
      correlationId: 'x:1',
      at: 1,
      originId: 'x'
    });
    await tab.core.loadState();
    tab.core.state.domains = [];
    expect((await tab.sync.start()).started).toBe(true);
    await flushAsync();
    expect(tab.core.state.domains[0]?.name).toBe('Recovered');
    expect(tab.listeners.size).toBe(1);
    expect(tab.notifications.some((note) => note.message.includes('resynchronised'))).toBe(true);
  });

  it('a tab closed during activity resumes without loss or duplication (boot load + no-op resync)', async () => {
    const backend: Backend = { records: new Map() };
    backend.records.set(STATE_KEY, JSON.stringify(makeDocument()));
    const hub = createFakeMediatorHub();
    // A stale cursor from a previous page load: a fresh client's window is
    // empty and cursors restart, so resume is accepted without replay — the
    // boot loadState() already applied the current document.
    const tab = createTab(backend, hub, { cursorStorage: createFakeStorage({ [DESIGNER_SYNC_CURSOR_KEY]: '42' }) });
    await tab.core.loadState();
    expect(tab.core.state.domains).toHaveLength(1);
    expect((await tab.sync.start()).started).toBe(true);
    const resumeResult = await tab.sync.resume();
    expect(resumeResult).toStrictEqual({ resynced: false, reason: 'already-current' });
    expect(tab.renders.filter((kind) => kind === 'sync-render')).toHaveLength(0);
  });

  it('a backgrounded tab catches up on resume and pays no re-render when nothing changed', async () => {
    const backend: Backend = { records: new Map() };
    const hub = createFakeMediatorHub();
    const tabA = createTab(backend, hub);
    const tabB = createTab(backend, hub);
    await tabA.core.loadState();
    await tabB.core.loadState();
    await tabA.sync.start();
    await tabB.sync.start();

    // B is "hidden": the channel message arrives but the tab never flushes;
    // on return, resume() catches up by document read-back.
    await edit(tabA, () => {
      tabA.core.state.domains[0].name = 'Edited while hidden';
    });
    const resumeResult = await tabB.sync.resume();
    expect(resumeResult.resynced).toBe(true);
    expect(tabB.core.state.domains[0].name).toBe('Edited while hidden');
    expect(lastNotification(tabB).message).toContain('caught up');
    const again = await tabB.sync.resume();
    expect(again).toStrictEqual({ resynced: false, reason: 'already-current' });
  });

  it('resume() before start() is a declared no-op', async () => {
    const backend: Backend = { records: new Map() };
    const hub = createFakeMediatorHub();
    const tab = createTab(backend, hub);
    await expect(tab.sync.resume()).resolves.toStrictEqual({ resynced: false, reason: 'not-started' });
    await expect(tab.sync.resync()).resolves.toStrictEqual({ resynced: false, reason: 'empty' });
  });
});

describe('designerSync — unknown-outcome saves surface and reconcile (Cana JUM-411)', () => {
  it('a committed save reports nothing', async () => {
    const backend: Backend = { records: new Map() };
    const hub = createFakeMediatorHub();
    const tab = createTab(backend, hub);
    await tab.core.loadState();
    await tab.sync.start();
    await expect(tab.sync.reportSaveOutcome({ status: 'persisted' })).resolves.toStrictEqual({ confirmed: true });
    expect(tab.notifications).toStrictEqual([]);
  });

  it('an unknown save whose write landed is confirmed by read-back reconciliation', async () => {
    const backend: Backend = { records: new Map() };
    const hub = createFakeMediatorHub();
    const tab = createTab(backend, hub);
    await tab.core.loadState();
    await tab.sync.start();
    tab.saveOutcomes.length = 0;
    tab.script.transactionOutcome = 'unknown';
    tab.script.applyOnUnknown = true;
    await edit(tab, () => {
      tab.core.state.domains[0].name = 'Maybe written';
    });
    await flushAsync();
    expect(tab.saveOutcomes).toHaveLength(1);
    await expect(tab.saveOutcomes[0]).resolves.toStrictEqual({ confirmed: true, reconciled: 'read-back-match' });
    expect(tab.notifications.some((note) => note.severity === 'error'
      && note.message.includes('could not be confirmed'))).toBe(true);
    expect(lastNotification(tab).message).toContain('confirmed after reconciliation');
    expect(tab.core.state.domains[0].name).toBe('Maybe written');
  });

  it('an unknown save whose write did NOT land reloads the last confirmed state', async () => {
    const backend: Backend = { records: new Map() };
    const hub = createFakeMediatorHub();
    const tab = createTab(backend, hub);
    await tab.core.loadState();
    await tab.sync.start();
    tab.saveOutcomes.length = 0;
    tab.script.transactionOutcome = 'unknown';
    await edit(tab, () => {
      tab.core.state.domains[0].name = 'Lost write';
    });
    await flushAsync();
    await expect(tab.saveOutcomes[0]).resolves.toStrictEqual({ confirmed: false, reconciled: 'reloaded' });
    // The stored document (the seeded template) is the truth; the unconfirmed
    // edit is gone from state and the user was told, never silently.
    expect(tab.core.state.domains[0].name).toBe('Billing');
    expect(lastNotification(tab).message).toContain('reloaded the last confirmed state');
    expect(lastNotification(tab).severity).toBe('error');
  });

  it('an unknown save with an unreadable store surfaces the no-fallback state', async () => {
    const backend: Backend = { records: new Map() };
    const hub = createFakeMediatorHub();
    const tab = createTab(backend, hub);
    await tab.core.loadState();
    await tab.sync.start();
    tab.script.readError = canaError('Internal', 'Engine fault.');
    const outcome = await tab.sync.reportSaveOutcome({ status: 'unknown', reason: 'unknown-outcome: torn down' }, {});
    expect(outcome).toStrictEqual({ confirmed: false, reason: 'unavailable' });
    expect(lastNotification(tab).message).toContain('no fallback store');
  });

  it('a rejected save promise is observed as an unknown outcome, never unhandled', async () => {
    const observed: Array<{ result: any; payload: any }> = [];
    const rejectingStore = {
      save: () => Promise.reject(new Error('worker gone')),
      load: () => Promise.resolve({ status: 'empty', payload: null })
    };
    const core = createDesignerState({
      store: rejectingStore,
      seed: () => undefined,
      render: () => undefined,
      onSaveResult: (result: any, payload: any) => observed.push({ result, payload })
    });
    core.saveState();
    await flushAsync();
    expect(observed).toHaveLength(1);
    expect(observed[0].result.status).toBe('unknown');
    expect(observed[0].result.reason).toContain('save-rejected: worker gone');
    expect(observed[0].payload).toHaveProperty('domains');
  });
});

describe('designerSync — declared unavailable states, never a silent single-tab session', () => {
  it('an unavailable BroadcastChannel is declared through the status region and local saves keep working', async () => {
    const backend: Backend = { records: new Map() };
    const hub = createFakeMediatorHub();
    const tab = createTab(backend, hub, { noChannel: true });
    await tab.core.loadState();
    const started = await tab.sync.start();
    expect(started.channelAvailable).toBe(false);
    expect(tab.notifications.some((note) => note.severity === 'error'
      && note.message.includes('BroadcastChannel'))).toBe(true);
    // Still writing to Cana (declared degraded, not blocked, never silent).
    await edit(tab, () => {
      tab.core.state.domains[0].name = 'Local only';
    });
    const stored = JSON.parse(backend.records.get(STATE_KEY) as string);
    expect(stored.domains[0].name).toBe('Local only');
  });

  it('a store that cannot open declares the sync outage instead of faking convergence', async () => {
    const backend: Backend = { records: new Map() };
    const hub = createFakeMediatorHub();
    const tab = createTab(backend, hub);
    tab.script.openError = canaError('Unavailable', 'No usable IndexedDB in this environment.');
    const started = await tab.sync.start();
    expect(started).toStrictEqual({ started: false, reason: expect.stringContaining('Unavailable') });
    expect(lastNotification(tab).severity).toBe('error');
    expect(lastNotification(tab).message).toContain('could not start');
  });

  it('a client without the ordered listener API declares the outage', async () => {
    const backend: Backend = { records: new Map() };
    const hub = createFakeMediatorHub();
    const tab = createTab(backend, hub);
    delete (tab.client as any).subscribe;
    const started = await tab.sync.start();
    expect(started.started).toBe(false);
    expect(lastNotification(tab).message).toContain('ordered listener API');
  });

  it('a resync against an unreadable store is declared, with the current state kept', async () => {
    const backend: Backend = { records: new Map() };
    const hub = createFakeMediatorHub();
    const tab = createTab(backend, hub);
    await tab.core.loadState();
    await tab.sync.start();
    tab.script.readError = canaError('Internal', 'Engine fault.');
    const result = await tab.sync.resync();
    expect(result).toStrictEqual({ resynced: false, reason: 'unavailable' });
    expect(tab.core.state.domains).toHaveLength(1);
    expect(lastNotification(tab).message).toContain('could not resynchronise');
  });
});

describe('designerSync — malformed remote input never applies partially', () => {
  it('an undecodable remote record triggers a resync instead of a partial apply', async () => {
    const backend: Backend = { records: new Map() };
    const hub = createFakeMediatorHub();
    const tabA = createTab(backend, hub);
    const tabB = createTab(backend, hub);
    await tabB.core.loadState();
    await tabB.sync.start();
    const before = JSON.stringify(tabB.core.state.domains);
    tabB.sync.onChannelMessage({ originId: tabA.sync.originId, record: '{not-json' });
    tabB.flush();
    expect(JSON.stringify(tabB.core.state.domains)).toBe(before);
    expect(tabB.notifications.some((note) => note.message.includes('could not be decoded')
      && note.severity === 'error')).toBe(true);
    await flushAsync();
  });

  it('ignores malformed channel messages', async () => {
    const backend: Backend = { records: new Map() };
    const hub = createFakeMediatorHub();
    const tab = createTab(backend, hub);
    await tab.core.loadState();
    await tab.sync.start();
    tab.sync.onChannelMessage(null);
    tab.sync.onChannelMessage('noise');
    tab.sync.onChannelMessage({ originId: 'other' });
    tab.sync.onChannelMessage({ originId: 'other', record: 42 });
    expect(tab.timers.size).toBe(0);
    expect(tab.sync.flushPendingRemote()).toStrictEqual({ applied: false, reason: 'no-pending-remote' });
  });
});

describe('designerSync — lifecycle', () => {
  it('stop() unsubscribes, drops pending applies and leaves injected channels open', async () => {
    const backend: Backend = { records: new Map() };
    const hub = createFakeMediatorHub();
    const tabA = createTab(backend, hub);
    const tabB = createTab(backend, hub);
    await tabA.core.loadState();
    await tabB.core.loadState();
    await tabA.sync.start();
    await tabB.sync.start();
    expect((await tabB.sync.start()).already).toBe(true);

    await edit(tabA, () => {
      tabA.core.state.domains[0].name = 'Pending edit';
    });
    expect(tabB.timers.size).toBe(1);
    tabB.sync.stop();
    expect(tabB.listeners.size).toBe(0);
    tabB.flush();
    expect(tabB.core.state.domains[0].name).toBe('Billing');
    // The injected channel is NOT closed by stop() (ownership stays with the caller).
    const channelB = [...hub.channels].find((channel) => channel.closed);
    expect(channelB).toBeUndefined();
  });

  it('resolves and closes its own BroadcastChannel when none is injected', async () => {
    const backend: Backend = { records: new Map() };
    const hub = createFakeMediatorHub();
    const tab = createTab(backend, hub);
    const ownChannelSync = createDesignerSync({
      store: tab.store,
      designerState: tab.core,
      notify: () => undefined,
      render: () => undefined,
      cursorStorage: createFakeStorage()
    });
    const started = await ownChannelSync.start();
    expect(started.channelAvailable).toBe(true);
    ownChannelSync.stop();
    await expect(ownChannelSync.resume()).resolves.toStrictEqual({ resynced: false, reason: 'not-started' });
  });

  it('applyRemoteDocument is the one apply path: exported for the boot and tests', () => {
    const core = createDesignerState({
      store: { save: () => Promise.resolve({ status: 'persisted' }) },
      seed: () => undefined,
      render: () => undefined
    });
    core.state.selectedDomainId = 'gone';
    const { reconciled } = applyRemoteDocument(core, makeDocument({ domains: [makeDomain('domain-3', 'New')] }));
    expect(core.state.domains[0].id).toBe('domain-3');
    expect(core.state.selectedDomainId).toBe('domain-3');
    expect(reconciled).toStrictEqual(['domain']);
    expect(core.history.future).toStrictEqual([]);
  });

  it('pins the channel name and cursor key', () => {
    expect(DESIGNER_SYNC_CHANNEL_NAME).toBe('service-management.cana-write-events');
    expect(DESIGNER_SYNC_CURSOR_KEY).toBe('service-management.v1.sync-cursor');
  });
});

describe('designerSync — defensive defaults', () => {
  it('reconciles dangling relationship and entity selections directly', () => {
    const state = {
      domains: [makeDomain('domain-1', 'Billing', [makeEntity('entity-1', 'Invoice')])],
      relationships: [{ id: 'rel-1', fromEntityId: 'entity-1', toEntityId: 'entity-1' }],
      selectedDomainId: 'domain-1',
      selectedEntityId: 'entity-9',
      selectedRelationshipId: 'rel-9'
    };
    expect(reconcileSelection(state)).toStrictEqual(['relationship', 'entity']);
    expect(state.selectedRelationshipId).toBeNull();
    expect(state.selectedEntityId).toBeNull();
    expect(state.selectedDomainId).toBe('domain-1');
  });

  it('runs with the ambient cursor storage and the real scheduler when none are injected', async () => {
    const backend: Backend = { records: new Map() };
    const hub = createFakeMediatorHub();
    const tab = createTab(backend, hub);
    const defaulted = createDesignerSync({
      store: tab.store,
      designerState: tab.core,
      channel: hub.createChannel(),
      originId: 'ambient-tab',
      notify: (message: string, severity: string) => tab.notifications.push({ message, severity }),
      render: () => tab.renders.push('ambient-render')
    });
    expect((await defaulted.start()).started).toBe(true);
    defaulted.onChannelMessage({
      originId: 'remote-tab',
      record: JSON.stringify(makeDocument({ domains: [makeDomain('domain-5', 'Stale')] }))
    });
    // A second message inside the window cancels the first through the
    // DEFAULT cancelSchedule (real clearTimeout) and reschedules.
    defaulted.onChannelMessage({
      originId: 'remote-tab',
      record: JSON.stringify(makeDocument({ domains: [makeDomain('domain-5', 'Ambient')] }))
    });
    // JUM-679: polled, not slept through. This test exercises the DEFAULT
    // scheduler on purpose, so the schedule cannot be injected here — but a
    // 100ms wait was still a guess about how fast the machine is. The poll
    // returns the moment the coalesced write lands and says what it was waiting
    // for if it never does.
    await until(() => tab.core.state.domains[0]?.name === 'Ambient', {
      describe: 'the coalesced ambient write from the default scheduler'
    });

    expect(tab.core.state.domains[0]?.name).toBe('Ambient');
    expect(tab.renders).toContain('ambient-render');
    expect(tab.renders.filter((kind) => kind === 'ambient-render')).toHaveLength(1);
    defaulted.stop();
  });

  it('a runtime without BroadcastChannel resolves no channel and declares the outage', async () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'BroadcastChannel');
    if (!descriptor || descriptor.configurable !== true) {
      // A non-configurable global cannot be removed for this probe; the
      // injected-null channel path above already pins the declared state.
      return;
    }
    const backend: Backend = { records: new Map() };
    const hub = createFakeMediatorHub();
    const tab = createTab(backend, hub);
    delete (globalThis as any).BroadcastChannel;
    try {
      const sync = createDesignerSync({
        store: tab.store,
        designerState: tab.core,
        originId: 'no-bc-tab',
        notify: (message: string, severity: string) => {
          tab.notifications.push({ message, severity });
        },
        render: () => undefined,
        cursorStorage: createFakeStorage()
      });
      const started = await sync.start();
      expect(started.channelAvailable).toBe(false);
      expect(lastNotification(tab).message).toContain('BroadcastChannel');
      expect(lastNotification(tab).severity).toBe('error');
    } finally {
      Object.defineProperty(globalThis, 'BroadcastChannel', descriptor);
    }
  });
});

describe('designerSync — defensive guards reach the coverage threshold (Req 020/063)', () => {
  it('tolerates a hostile ambient localStorage (cursor persistence degrades, never throws)', async () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    if (descriptor && descriptor.configurable !== true) {
      // A non-configurable ambient localStorage cannot be made hostile here.
      return;
    }
    const backend: Backend = { records: new Map() };
    const hub = createFakeMediatorHub();
    const tab = createTab(backend, hub);
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() { throw new Error('hostile storage'); }
    });
    try {
      // No cursorStorage injected: the ambient resolution hits the guard on
      // BOTH the read (start) and the write (local event) side.
      const sync = createDesignerSync({
        store: tab.store,
        designerState: tab.core,
        channel: hub.createChannel(),
        originId: 'hostile-tab'
      });
      expect((await sync.start()).started).toBe(true);
      sync.onLocalEvent({
        store: STORE_NAME,
        key: STATE_KEY,
        record: JSON.stringify(makeDocument()),
        cursor: 1
      });
      expect(sync.getLastCursor()).toBe(1);
      sync.stop();
    } finally {
      if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
      else delete (globalThis as any).localStorage;
    }
  });

  it('falls back to the Math.random tab identity when crypto.randomUUID is absent', () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
    if (descriptor && descriptor.configurable !== true) {
      return;
    }
    const hadCrypto = 'crypto' in globalThis;
    delete (globalThis as any).crypto;
    try {
      const sync = createDesignerSync({ store: undefined, designerState: undefined });
      expect(sync.originId).toMatch(/^designer-tab-/);
    } finally {
      if (hadCrypto && descriptor) Object.defineProperty(globalThis, 'crypto', descriptor);
    }
  });

  it('reads a persisted cursor defensively: throwing or garbage storage means no resume cursor', async () => {
    const backend: Backend = { records: new Map() };
    const hub = createFakeMediatorHub();
    const throwing = createTab(backend, hub, {
      cursorStorage: {
        getItem: () => { throw new Error('hostile'); },
        setItem: () => undefined,
        removeItem: () => undefined,
        map: new Map()
      } as any
    });
    await throwing.core.loadState();
    expect((await throwing.sync.start()).started).toBe(true);
    throwing.sync.stop();

    const garbage = createTab(backend, hub, {
      cursorStorage: createFakeStorage({ [DESIGNER_SYNC_CURSOR_KEY]: 'not-a-number' })
    });
    expect((await garbage.sync.start()).started).toBe(true);
    garbage.sync.stop();

    // An injected null backend: cursor persistence is a no-op, never a crash.
    const nullBackend = createTab(backend, hub, { cursorStorage: null as any });
    expect((await nullBackend.sync.start()).started).toBe(true);
    nullBackend.sync.onLocalEvent({
      store: STORE_NAME,
      key: STATE_KEY,
      record: JSON.stringify(makeDocument()),
      cursor: 3
    });
    expect(nullBackend.sync.getLastCursor()).toBe(3);
    nullBackend.sync.stop();
  });

  it('delivers bare messages through the onmessage branch (no data wrapper)', async () => {
    const backend: Backend = { records: new Map() };
    const hub = createFakeMediatorHub();
    const tab = createTab(backend, hub);
    await tab.core.loadState();
    await tab.sync.start();
    const channel = [...hub.channels][0];
    // The channel contract also accepts a bare message (no MessageEvent).
    channel.onmessage({ originId: 'remote-tab', record: JSON.stringify(makeDocument({ domains: [] })) });
    tab.flush();
    expect(tab.core.state.domains).toStrictEqual([]);
  });

  it('applies a remote message with the default coalesced count and default render/notify', async () => {
    const backend: Backend = { records: new Map() };
    const hub = createFakeMediatorHub();
    const tab = createTab(backend, hub);
    const sync = createDesignerSync({
      store: tab.store,
      designerState: tab.core,
      channel: hub.createChannel(),
      originId: 'defaults-tab',
      cursorStorage: createFakeStorage()
    });
    const result = sync.applyRemoteMessage({
      originId: 'remote-tab',
      record: JSON.stringify(makeDocument({ domains: [makeDomain('domain-8', 'Defaults')] }))
    });
    expect(result).toStrictEqual({ applied: true, reconciled: [] });
    expect(tab.core.state.domains[0]?.name).toBe('Defaults');
  });

  it('announces an unknown save without a reason string as an unknown outcome', async () => {
    const backend: Backend = { records: new Map() };
    const hub = createFakeMediatorHub();
    const tab = createTab(backend, hub);
    await tab.core.loadState();
    await tab.sync.start();
    const outcome = await tab.sync.reportSaveOutcome({ status: 'unknown' });
    expect(outcome.confirmed).toBe(false);
    expect(tab.notifications.some((note) => note.message.includes('unknown outcome'))).toBe(true);
  });

  it('resyncs a minimal state object and declares a reason-less store outage', async () => {
    const document = makeDocument({ domains: [makeDomain('domain-6', 'Minimal')] });
    const stubStore = {
      storeName: STORE_NAME,
      loadCalls: 0,
      fail: false,
      async ensureOpen() { return { ok: true }; },
      async load() {
        stubStore.loadCalls += 1;
        if (stubStore.fail) return { status: 'unavailable', payload: null };
        return { status: 'ok', payload: JSON.parse(JSON.stringify(document)) };
      }
    };
    // A bare state object: the model-slice fallbacks and the absent
    // recomputeIdCounter branch all cross here.
    const minimalCore = { state: {}, history: { future: ['redo'] } };
    const renders: string[] = [];
    const notes: Array<{ message: string; severity: string }> = [];
    const sync = createDesignerSync({
      store: stubStore,
      designerState: minimalCore,
      render: () => renders.push('render'),
      notify: (message: string, severity: string) => notes.push({ message, severity }),
      channel: undefined,
      cursorStorage: createFakeStorage()
    });
    const resynced = await sync.resync();
    expect(resynced.resynced).toBe(true);
    expect((minimalCore.state as any).domains[0]?.name).toBe('Minimal');
    expect(minimalCore.history.future).toStrictEqual([]);

    stubStore.fail = true;
    const failed = await sync.resync();
    expect(failed).toStrictEqual({ resynced: false, reason: 'unavailable' });
    expect(lastItem(notes).message).toContain('could not resynchronise');
    expect(lastItem(notes).message).not.toContain('(');
  });

  it('applyRemoteDocument tolerates a null payload as an empty document', () => {
    const core = createDesignerState({
      store: { save: () => Promise.resolve({ status: 'persisted' }) },
      seed: () => undefined,
      render: () => undefined
    });
    const { reconciled } = applyRemoteDocument(core, null);
    expect(core.state.domains).toStrictEqual([]);
    expect(reconciled).toStrictEqual([]);
  });

  it('constructs with no options at all (defaults only)', () => {
    const sync = createDesignerSync();
    expect(typeof sync.originId).toBe('string');
    expect(sync.getLastCursor()).toBeNull();
  });
});
