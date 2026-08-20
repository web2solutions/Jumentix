import {
  createRenderer, defineComponent, h, ref
} from 'vue';
import type { CanaChangeEvent } from '@jumentix/cana';
import { connectCanaToPinia, useCanaLiveQuery, useCanaSubscription } from '../src';

/**
 * The composables, run inside a real Vue component instance (JUM-681).
 *
 * `useCanaSubscription` and `useCanaLiveQuery` do their work in `onMounted` and
 * `onUnmounted`, so calling them as plain functions runs the setup body and
 * nothing else — which is how a suite can exercise these files and still never
 * subscribe, never load, and never unsubscribe. Everything that matters here
 * happens on mount and teardown.
 *
 * Vue is real: `createRenderer` is Vue's own renderer factory, the same one
 * `createApp` is built on, given host operations that build plain objects
 * instead of DOM nodes. Scheduling, the component instance, the lifecycle order
 * and the reactivity are Vue's — only the nodes are inert, because these
 * composables never touch a node.
 *
 * The **client is a double**, and deliberately so (Requirement 135 §5): what is
 * under test is the composable's handling of a change broker, not IndexedDB.
 * The double records what it was subscribed with and hands the listener back, so
 * the assertions are about the arguments the composable passed and the state it
 * produced, never about a store's behaviour.
 */
type Row = { id: string; name: string };

/** Host operations for a renderer with no DOM: nodes are objects, and unused. */
const nodeOps = {
  createElement: (tag: string) => ({ tag, children: [] as unknown[] }),
  createText: () => ({}),
  createComment: () => ({}),
  setText: () => undefined,
  setElementText: () => undefined,
  insert: () => undefined,
  remove: () => undefined,
  parentNode: () => null,
  nextSibling: () => null,
  querySelector: () => null,
  setScopeId: () => undefined,
  patchProp: () => undefined
};

const { createApp } = createRenderer(nodeOps as never);

/** Mount `setup` in a real component, returning its result and an unmount. */
function mounted<TResult>(setup: () => TResult): { result: TResult; unmount: () => void } {
  let result!: TResult;
  const app = createApp(defineComponent({
    setup() {
      result = setup();
      return () => h('div');
    }
  }));
  app.mount(nodeOps.createElement('root') as never);
  return { result, unmount: () => app.unmount() };
}

/** A change broker double: records its subscription, replays on demand. */
function brokerDouble(options: {
  rows?: Row[];
  failQuery?: boolean;
  failSubscribe?: boolean;
} = {}) {
  const calls: { sinceCursor?: number }[] = [];
  let listener: ((event: CanaChangeEvent) => void) | undefined;
  let stopped = 0;

  const client = {
    subscribe(next: (event: CanaChangeEvent) => void, subscribeOptions?: { sinceCursor: number }) {
      if (options.failSubscribe) throw new Error('subscribe refused');
      calls.push({ sinceCursor: subscribeOptions?.sinceCursor });
      listener = next;
      return () => { stopped += 1; };
    },
    table() {
      return {
        query: async () => {
          if (options.failQuery) throw new Error('query refused');
          return options.rows ?? [];
        }
      };
    }
  };

  return {
    client: client as never,
    calls,
    stops: () => stopped,
    emit: (event: Partial<CanaChangeEvent<Row>>) => listener?.({
      type: 'created',
      store: 'rows',
      key: 'a',
      record: { id: 'a', name: 'A' },
      cursor: 1,
      correlationId: 'corr',
      at: 1,
      originId: 'test',
      ...event
    } as CanaChangeEvent)
  };
}

/** Lets Vue's scheduler and the composable's own promises settle. */
const settle = async () => { await Promise.resolve(); await Promise.resolve(); };

describe('useCanaSubscription (JUM-681)', () => {
  it('subscribes on mount and stops on unmount', () => {
    expect.hasAssertions();

    const broker = brokerDouble();
    const { unmount } = mounted(() => useCanaSubscription(broker.client, () => undefined));

    expect(broker.calls).toStrictEqual([{ sinceCursor: undefined }]);

    unmount();

    expect(broker.stops()).toBe(1);
  });

  it('reads the client out of a ref', () => {
    expect.hasAssertions();

    // Vue callers hold a `ref` far more often than a bare client, and the branch
    // that unwraps it is the difference between subscribing and silently not.
    const broker = brokerDouble();
    const client = ref(broker.client);

    mounted(() => useCanaSubscription(client as never, () => undefined, { sinceCursor: 7 }));

    expect(broker.calls).toStrictEqual([{ sinceCursor: 7 }]);
  });

  it('does not subscribe when disabled, or when there is no client', () => {
    expect.hasAssertions();

    const disabled = brokerDouble();
    mounted(() => useCanaSubscription(disabled.client, () => undefined, { enabled: false }));

    const absent = brokerDouble();
    mounted(() => useCanaSubscription(null, () => undefined));

    expect(disabled.calls).toStrictEqual([]);
    expect(absent.calls).toStrictEqual([]);
  });

  it('delivers events to the listener it was given', () => {
    expect.hasAssertions();

    const broker = brokerDouble();
    const seen: CanaChangeEvent[] = [];

    mounted(() => useCanaSubscription(broker.client, (event) => seen.push(event)));
    broker.emit({ cursor: 4 });

    expect(seen).toHaveLength(1);
    expect(seen[0].cursor).toBe(4);
  });

  it('reports a refused subscription rather than throwing out of mount', () => {
    expect.hasAssertions();

    // A composable that throws in `onMounted` takes the component down with it.
    const broker = brokerDouble({ failSubscribe: true });
    const errors: unknown[] = [];

    mounted(() => useCanaSubscription(broker.client, () => undefined, {
      onError: (error) => errors.push(error)
    }));

    expect(errors).toHaveLength(1);
    expect((errors[0] as Error).message).toBe('subscribe refused');
  });

  it('survives a refused subscription with no error handler', () => {
    expect.hasAssertions();

    const broker = brokerDouble({ failSubscribe: true });

    expect(() => mounted(() => useCanaSubscription(broker.client, () => undefined))).not.toThrow();
  });

  it('stops on request, and stays stopped when unmount follows', () => {
    expect.hasAssertions();

    const broker = brokerDouble();
    const { result, unmount } = mounted(() => useCanaSubscription(
      broker.client,
      () => undefined
    ));

    result.stop();
    result.stop();
    unmount();

    // Three calls to stop, one actual unsubscribe: the handle is cleared each
    // time, so a double stop cannot unsubscribe a later subscription.
    expect(broker.stops()).toBe(1);
  });
});

describe('useCanaLiveQuery (JUM-681)', () => {
  it('loads on mount and reports ready', async () => {
    expect.hasAssertions();

    const broker = brokerDouble({ rows: [{ id: 'b', name: 'B' }, { id: 'a', name: 'A' }] });
    const { result } = mounted(() => useCanaLiveQuery<Row>({
      client: ref(broker.client) as never,
      store: 'rows',
      sort: (left, right) => left.id.localeCompare(right.id)
    }));

    await settle();

    expect(result.status.value).toBe('ready');
    expect(result.records.value.map((row) => row.id)).toStrictEqual(['a', 'b']);
  });

  it('reports a failed load as an error rather than an empty result', async () => {
    expect.hasAssertions();

    // An empty array and a failed query look identical to a caller that only
    // reads `records`, which is why `status` and `error` exist.
    const broker = brokerDouble({ failQuery: true });
    const errors: unknown[] = [];
    const { result } = mounted(() => useCanaLiveQuery<Row>({
      client: broker.client,
      store: 'rows',
      onError: (error) => errors.push(error)
    }));

    await settle();

    expect(result.status.value).toBe('error');
    expect((result.error.value as Error).message).toBe('query refused');
    expect(errors).toHaveLength(1);
  });

  it('patches records in place when the query is a whole store', async () => {
    expect.hasAssertions();

    // No query means no reload on every event: the event is applied to the array
    // that is already there, which is the whole point of the live collection.
    const broker = brokerDouble({ rows: [] });
    const { result } = mounted(() => useCanaLiveQuery<Row>({
      client: broker.client,
      store: 'rows',
      getKey: (row) => row.id
    }));

    await settle();
    broker.emit({ record: { id: 'c', name: 'C' } });

    // Read field by field: `records` is a Vue reactive array, so the entries are
    // proxies, and a structural comparison against plain objects is a comparison
    // of prototypes rather than of data.
    expect(result.records.value).toHaveLength(1);
    expect(result.records.value[0].id).toBe('c');
    expect(result.records.value[0].name).toBe('C');
  });

  it('ignores events from another store', async () => {
    expect.hasAssertions();

    const broker = brokerDouble({ rows: [] });
    const { result } = mounted(() => useCanaLiveQuery<Row>({
      client: broker.client,
      store: 'rows',
      getKey: (row) => row.id
    }));

    await settle();
    broker.emit({ store: 'other', record: { id: 'z', name: 'Z' } });

    expect([...result.records.value]).toStrictEqual([]);
  });

  it('reloads on every event when a query narrows the store', async () => {
    expect.hasAssertions();

    // A filtered query cannot be patched from an event alone — the event says
    // what changed, not whether it still matches — so the query runs again.
    let served: Row[] = [{ id: 'a', name: 'A' }];
    const broker = brokerDouble();
    const client = {
      subscribe: (broker.client as unknown as {
        subscribe: (next: (event: CanaChangeEvent) => void) => () => void;
      }).subscribe,
      table: () => ({ query: async () => served })
    };

    const { result } = mounted(() => useCanaLiveQuery<Row>({
      client: client as never,
      store: 'rows',
      query: { limit: 10 }
    }));

    await settle();
    served = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }];
    broker.emit({});
    await settle();

    expect(result.records.value).toHaveLength(2);
  });

  it('does nothing without a client, or while disabled', async () => {
    expect.hasAssertions();

    const disabled = brokerDouble({ rows: [{ id: 'a', name: 'A' }] });
    const off = mounted(() => useCanaLiveQuery<Row>({
      client: disabled.client,
      store: 'rows',
      enabled: false
    }));
    const none = mounted(() => useCanaLiveQuery<Row>({ client: null, store: 'rows' }));

    await settle();

    expect(off.result.status.value).toBe('idle');
    expect(disabled.calls).toStrictEqual([]);
    await expect(none.result.reload()).resolves.toStrictEqual([]);
  });

  it('keeps a late load from writing into an unmounted component', async () => {
    expect.hasAssertions();

    // The reload is in flight when the component goes away. Writing its result
    // is a Vue warning at best and a resurrected subscription at worst.
    let release: (rows: Row[]) => void = () => undefined;
    const pending = new Promise<Row[]>((resolve) => { release = resolve; });
    const client = {
      subscribe: () => () => undefined,
      table: () => ({ query: () => pending })
    };

    const { result, unmount } = mounted(() => useCanaLiveQuery<Row>({
      client: client as never,
      store: 'rows'
    }));

    unmount();
    release([{ id: 'a', name: 'A' }]);
    await settle();

    expect([...result.records.value]).toStrictEqual([]);
    expect(result.status.value).toBe('loading');
  });

  it('keeps a late failure from writing into an unmounted component', async () => {
    expect.hasAssertions();

    let reject: (error: unknown) => void = () => undefined;
    const pending = new Promise<Row[]>((_resolve, onReject) => { reject = onReject; });
    const errors: unknown[] = [];
    const client = {
      subscribe: () => () => undefined,
      table: () => ({ query: () => pending })
    };

    const { result, unmount } = mounted(() => useCanaLiveQuery<Row>({
      client: client as never,
      store: 'rows',
      onError: (error) => errors.push(error)
    }));

    unmount();
    reject(new Error('too late'));
    await settle();

    // The handler still hears about it — the caller asked to be told — but the
    // refs belong to a component that no longer exists.
    expect(errors).toHaveLength(1);
    expect(result.error.value).toBeNull();
  });

  it('stops the subscription on request and on unmount', async () => {
    expect.hasAssertions();

    const broker = brokerDouble({ rows: [] });
    const { result, unmount } = mounted(() => useCanaLiveQuery<Row>({
      client: broker.client,
      store: 'rows'
    }));

    await settle();
    result.stop();
    unmount();

    expect(broker.stops()).toBe(1);
  });
});

describe('connectCanaToPinia (JUM-681)', () => {
  it('subscribes from the requested cursor', () => {
    expect.hasAssertions();

    const broker = brokerDouble();
    const bridge = connectCanaToPinia({
      client: broker.client,
      apply: () => undefined,
      sinceCursor: 12
    });

    expect(broker.calls).toStrictEqual([{ sinceCursor: 12 }]);
    // No event yet: the cursor is the one the caller asked to resume from, not
    // zero, or a store that replays from the beginning on the next reconnect.
    expect(bridge.getLastCursor()).toBe(12);
  });

  it('reports and rethrows a refused subscription', () => {
    expect.hasAssertions();

    // Rethrown on purpose: a Pinia store wired to a subscription that does not
    // exist would sit there looking connected.
    const broker = brokerDouble({ failSubscribe: true });
    const errors: unknown[] = [];

    expect(() => connectCanaToPinia({
      client: broker.client,
      apply: () => undefined,
      onError: (error) => errors.push(error)
    })).toThrow('subscribe refused');
    expect(errors).toHaveLength(1);
  });
});
