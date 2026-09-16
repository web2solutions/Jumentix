import { createElement } from 'react';
// React's own renderer, a devDependency of this package rather than of the
// workspace root, which is what the rule below is reacting to.
// eslint-disable-next-line import/no-extraneous-dependencies
import { act, create } from 'react-test-renderer';
import type { CanaChangeEvent } from '@jumentix/cana';
import { useCanaClient, useCanaLiveQuery, useCanaSubscription } from '../src';

/**
 * The hooks, rendered by React rather than called as functions (JUM-681).
 *
 * Everything these hooks do happens in `useEffect`: opening the client,
 * subscribing, loading, and — the part that only a renderer reaches — cleaning
 * all three up when the component goes away or its dependencies change. Calling
 * `useCanaLiveQuery({...})` outside a render runs none of it, so a suite can
 * import this file, execute its setup body, and prove nothing about the
 * behaviour a component actually gets.
 *
 * React is real: `react-test-renderer` is React's own renderer, running the
 * real reconciler, the real effect scheduling and the real `act` semantics with
 * host components that render to plain objects. These hooks never touch the
 * DOM, so no DOM is stood up for them.
 *
 * The **client is a double** (Requirement 135 §5/§7) — a change broker whose
 * subscription and query are scripted, so the assertions are about what the
 * hook did with them. Cana's own behaviour is verified in a real browser
 * against real IndexedDB, not here.
 */
// React's own flag for "this process is a test that drives `act`". Without it
// React warns on every render and, more to the point, refuses to treat the
// queued effects as flushable — the warning is React saying the assertions
// might be reading a component mid-update.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Row = { id: string; name: string };

/** A change broker double: records subscriptions, replays events on demand. */
function brokerDouble(options: {
  rows?: Row[];
  failQuery?: boolean;
  failSubscribe?: boolean;
  failOpen?: boolean;
} = {}) {
  const calls: { sinceCursor?: number }[] = [];
  let listener: ((event: CanaChangeEvent) => void) | undefined;
  let stopped = 0;
  let opens = 0;
  let closes = 0;

  const client = {
    async open() {
      opens += 1;
      if (options.failOpen) throw new Error('open refused');
    },
    async close() { closes += 1; },
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
    opens: () => opens,
    closes: () => closes,
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

/**
 * Render `hook` in a real component and keep its latest result readable.
 *
 * `act` is awaited so effects — and the state updates they schedule — are
 * flushed before the assertions run, which is the same contract application
 * code gets from React.
 */
async function renderHook<TResult>(hook: () => TResult) {
  const latest: { current: TResult } = { current: undefined as TResult };
  const Probe = () => {
    latest.current = hook();
    return null;
  };

  let renderer!: ReturnType<typeof create>;
  await act(async () => {
    renderer = create(createElement(Probe));
  });

  return {
    latest,
    rerender: async () => {
      await act(async () => { renderer.update(createElement(Probe)); });
    },
    unmount: async () => {
      await act(async () => { renderer.unmount(); });
    },
    flush: async () => { await act(async () => { await Promise.resolve(); }); }
  };
}

describe('useCanaClient (JUM-681)', () => {
  it('opens the client and reports ready', async () => {
    expect.hasAssertions();

    const broker = brokerDouble();
    const { latest } = await renderHook(() => useCanaClient(() => broker.client));

    expect(latest.current.status).toBe('ready');
    expect(latest.current.client).toBe(broker.client);
    expect(broker.opens()).toBe(1);
  });

  it('accepts a factory that resolves asynchronously', async () => {
    expect.hasAssertions();

    const broker = brokerDouble();
    const { latest } = await renderHook(() => useCanaClient(async () => broker.client));

    expect(latest.current.status).toBe('ready');
  });

  it('reports a refused open as an error rather than a null client', async () => {
    expect.hasAssertions();

    // `client: null` with `status: 'ready'` and `client: null` with a failed
    // open look identical to a component that only checks the client.
    const broker = brokerDouble({ failOpen: true });
    const { latest } = await renderHook(() => useCanaClient(() => broker.client));

    expect(latest.current.status).toBe('error');
    expect((latest.current.error as Error).message).toBe('open refused');
    expect(latest.current.client).toBeNull();
  });

  it('closes the client it opened when the component goes away', async () => {
    expect.hasAssertions();

    const broker = brokerDouble();
    const { unmount } = await renderHook(() => useCanaClient(() => broker.client));

    await unmount();

    // A database connection left open outlives the component and blocks the
    // next version upgrade, which is the failure users see as a frozen app.
    expect(broker.closes()).toBe(1);
  });

  it('closes a client that finishes opening after the component unmounted', async () => {
    expect.hasAssertions();

    let releaseOpen!: () => void;
    const broker = brokerDouble();
    const openedClient = broker.client as any;
    const slowClient = {
      ...openedClient,
      open: async () => new Promise<void>((resolve) => {
        releaseOpen = resolve;
      }),
      close: openedClient.close
    };
    const { unmount, flush } = await renderHook(() => useCanaClient(() => slowClient as never));
    await unmount();

    releaseOpen();
    await flush();

    expect(broker.closes()).toBeGreaterThanOrEqual(1);
  });

  it('ignores open failures that arrive after the component unmounted', async () => {
    expect.hasAssertions();

    let rejectOpen!: (error: Error) => void;
    const client = {
      open: async () => new Promise<void>((_resolve, reject) => {
        rejectOpen = reject;
      }),
      close: async () => undefined
    };
    const { latest, unmount, flush } = await renderHook(() => useCanaClient(() => client as never));
    await unmount();

    rejectOpen(new Error('late open refused'));
    await flush();

    expect(latest.current.error).toBeNull();
  });
});

describe('useCanaSubscription (JUM-681)', () => {
  it('subscribes on mount and unsubscribes on unmount', async () => {
    expect.hasAssertions();

    const broker = brokerDouble();
    const { unmount } = await renderHook(() => useCanaSubscription(broker.client, () => undefined));

    expect(broker.calls).toStrictEqual([{ sinceCursor: undefined }]);

    await unmount();

    expect(broker.stops()).toBe(1);
  });

  it('passes the resume cursor through', async () => {
    expect.hasAssertions();

    const broker = brokerDouble();
    await renderHook(() => useCanaSubscription(broker.client, () => undefined, { sinceCursor: 5 }));

    expect(broker.calls).toStrictEqual([{ sinceCursor: 5 }]);
  });

  it('does not subscribe without a client, or while disabled', async () => {
    expect.hasAssertions();

    const disabled = brokerDouble();
    await renderHook(() => useCanaSubscription(
      disabled.client,
      () => undefined,
      { enabled: false }
    ));
    await renderHook(() => useCanaSubscription(null, () => undefined));

    expect(disabled.calls).toStrictEqual([]);
  });

  it('delivers events to the latest listener, without resubscribing', async () => {
    expect.hasAssertions();

    // The listener is held in a ref on purpose: a new closure every render
    // would tear down and rebuild the subscription on each one, and a
    // subscription rebuilt mid-stream misses whatever arrived in between.
    const broker = brokerDouble();
    const seen: number[] = [];
    let generation = 1;
    const { rerender } = await renderHook(() => useCanaSubscription(
      broker.client,
      (event) => seen.push(generation * 100 + event.cursor)
    ));

    generation = 2;
    await rerender();
    broker.emit({ cursor: 7 });

    expect(seen).toStrictEqual([207]);
    expect(broker.calls).toHaveLength(1);
  });

  it('reports a refused subscription instead of crashing the render', async () => {
    expect.hasAssertions();

    const broker = brokerDouble({ failSubscribe: true });
    const errors: unknown[] = [];

    await renderHook(() => useCanaSubscription(broker.client, () => undefined, {
      onError: (error) => errors.push(error)
    }));

    expect(errors).toHaveLength(1);
    expect((errors[0] as Error).message).toBe('subscribe refused');
  });

  it('survives a refused subscription with no error handler', async () => {
    expect.hasAssertions();

    const broker = brokerDouble({ failSubscribe: true });
    const { latest } = await renderHook(() => {
      useCanaSubscription(broker.client, () => undefined);
      return 'rendered';
    });

    expect(latest.current).toBe('rendered');
  });
});

describe('useCanaLiveQuery (JUM-681)', () => {
  it('loads on mount, sorted, and reports ready', async () => {
    expect.hasAssertions();

    const broker = brokerDouble({ rows: [{ id: 'b', name: 'B' }, { id: 'a', name: 'A' }] });
    const sort = (left: Row, right: Row) => left.id.localeCompare(right.id);
    const { latest } = await renderHook(() => useCanaLiveQuery<Row>({
      client: broker.client,
      store: 'rows',
      sort
    }));

    expect(latest.current.status).toBe('ready');
    expect(latest.current.records.map((row) => row.id)).toStrictEqual(['a', 'b']);
  });

  it('reports a failed load as an error rather than an empty list', async () => {
    expect.hasAssertions();

    const broker = brokerDouble({ failQuery: true });
    const errors: unknown[] = [];
    const onError = (error: unknown) => { errors.push(error); };
    const { latest } = await renderHook(() => useCanaLiveQuery<Row>({
      client: broker.client,
      store: 'rows',
      onError
    }));

    expect(latest.current.status).toBe('error');
    expect((latest.current.error as Error).message).toBe('query refused');
    expect(errors).toHaveLength(1);
  });

  it('returns an empty result from reload without a client, or while disabled', async () => {
    expect.hasAssertions();

    const broker = brokerDouble({ rows: [{ id: 'a', name: 'A' }] });
    const off = await renderHook(() => useCanaLiveQuery<Row>({
      client: broker.client,
      store: 'rows',
      enabled: false
    }));
    const none = await renderHook(() => useCanaLiveQuery<Row>({ client: null, store: 'rows' }));

    await expect(off.latest.current.reload()).resolves.toStrictEqual([]);
    await expect(none.latest.current.reload()).resolves.toStrictEqual([]);
    expect(off.latest.current.status).toBe('idle');
    expect(broker.calls).toStrictEqual([]);
  });

  it('patches the collection in place when the query is the whole store', async () => {
    expect.hasAssertions();

    const broker = brokerDouble({ rows: [] });
    const getKey = (row: Row) => row.id;
    const { latest, flush } = await renderHook(() => useCanaLiveQuery<Row>({
      client: broker.client,
      store: 'rows',
      getKey
    }));

    await act(async () => { broker.emit({ record: { id: 'c', name: 'C' } }); });
    await flush();

    expect(latest.current.records).toStrictEqual([{ id: 'c', name: 'C' }]);
  });

  it('ignores an event from another store', async () => {
    expect.hasAssertions();

    const broker = brokerDouble({ rows: [] });
    const { latest, flush } = await renderHook(() => useCanaLiveQuery<Row>({
      client: broker.client,
      store: 'rows'
    }));

    await act(async () => { broker.emit({ store: 'other', record: { id: 'z', name: 'Z' } }); });
    await flush();

    expect(latest.current.records).toStrictEqual([]);
  });

  it('reloads on every event when a query narrows the store', async () => {
    expect.hasAssertions();

    // A filtered query cannot be patched from an event: the event says what
    // changed, not whether it still matches the filter.
    let served: Row[] = [{ id: 'a', name: 'A' }];
    const broker = brokerDouble();
    const client = {
      subscribe: (broker.client as unknown as {
        subscribe: (next: (event: CanaChangeEvent) => void) => () => void;
      }).subscribe,
      table: () => ({ query: async () => served })
    };
    const query = { limit: 10 };

    const { latest, flush } = await renderHook(() => useCanaLiveQuery<Row>({
      client: client as never,
      store: 'rows',
      query
    }));

    served = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }];
    await act(async () => { broker.emit({}); });
    await flush();

    expect(latest.current.records).toHaveLength(2);
  });

  it('keeps the same query object across renders when the query has not changed', async () => {
    expect.hasAssertions();

    // The query is memoised on its serialised form, so a caller passing a fresh
    // object literal every render — which every caller does — does not rebuild
    // the effect and re-run the load on every keystroke.
    let queries = 0;
    const client = {
      subscribe: () => () => undefined,
      table: () => ({ query: async () => { queries += 1; return []; } })
    };

    const { rerender } = await renderHook(() => useCanaLiveQuery<Row>({
      client: client as never,
      store: 'rows',
      query: { limit: 10 }
    }));

    await rerender();
    await rerender();

    expect(queries).toBe(1);
  });

  it('reloads on request and returns the records it loaded', async () => {
    expect.hasAssertions();

    let served: Row[] = [{ id: 'a', name: 'A' }];
    const client = {
      subscribe: () => () => undefined,
      table: () => ({ query: async () => served })
    };

    const { latest } = await renderHook(() => useCanaLiveQuery<Row>({
      client: client as never,
      store: 'rows'
    }));

    served = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }];
    let reloaded: Row[] = [];
    await act(async () => { reloaded = await latest.current.reload(); });

    expect(reloaded).toHaveLength(2);
    expect(latest.current.records).toHaveLength(2);
  });

  it('unsubscribes when the component goes away', async () => {
    expect.hasAssertions();

    const broker = brokerDouble({ rows: [] });
    const { unmount } = await renderHook(() => useCanaLiveQuery<Row>({
      client: broker.client,
      store: 'rows'
    }));

    await unmount();

    expect(broker.stops()).toBe(1);
  });

  it('ignores subscription events that race after unmount', async () => {
    expect.hasAssertions();

    let queries = 0;
    const broker = brokerDouble();
    const client = {
      subscribe: (broker.client as unknown as {
        subscribe: (next: (event: CanaChangeEvent) => void) => () => void;
      }).subscribe,
      table: () => ({
        query: async () => {
          queries += 1;
          return [];
        }
      })
    };
    const { unmount, flush } = await renderHook(() => useCanaLiveQuery<Row>({
      client: client as never,
      store: 'rows',
      query: { limit: 1 }
    }));
    expect(queries).toBe(1);

    await unmount();
    await act(async () => { broker.emit({}); });
    await flush();

    expect(queries).toBe(1);
  });
});

describe('failure paths at the effect boundary (JUM-821)', () => {
  it('swallows a refused close when the component goes away', async () => {
    expect.hasAssertions();

    // A close that rejects during unmount must not become an unhandled
    // rejection: the component is already gone, there is no one left to tell.
    let closes = 0;
    const client = {
      open: async () => undefined,
      close: async () => { closes += 1; throw new Error('close refused'); },
      subscribe: () => () => undefined,
      table: () => ({ query: async () => [] })
    };
    const { latest, unmount } = await renderHook(() => useCanaClient(() => client as never));
    expect(latest.current.status).toBe('ready');

    await unmount();

    expect(closes).toBe(1);
  });

  it('surfaces a failed initial load even when the error reporter throws', async () => {
    expect.hasAssertions();

    // `reload` reports through `onError` from inside its own catch; when THAT
    // call throws, the rejection crosses to the effect's `.catch`, which reports
    // the reporter's failure — the load error is never dropped silently.
    const broker = brokerDouble({ failQuery: true });
    const onError = jest.fn()
      .mockImplementationOnce(() => { throw new Error('reporting failed'); })
      .mockImplementation(() => undefined);

    const { latest } = await renderHook(() => useCanaLiveQuery<Row>({
      client: broker.client,
      store: 'rows',
      onError
    }));

    expect(latest.current.status).toBe('error');
    expect(onError.mock.calls.map(([error]) => (error as Error).message))
      .toStrictEqual(['query refused', 'reporting failed']);
  });

  it('surfaces a failed event-triggered reload even when the error reporter throws', async () => {
    expect.hasAssertions();

    // Same boundary, one level down: the subscription callback's own
    // `safeReload().catch(...)` is what must not lose the failure.
    const broker = brokerDouble();
    const query = jest.fn()
      .mockResolvedValueOnce([{ id: 'a', name: 'A' }])
      .mockRejectedValue(new Error('query refused'));
    const client = {
      subscribe: (broker.client as unknown as {
        subscribe: (next: (event: CanaChangeEvent) => void) => () => void;
      }).subscribe,
      table: () => ({ query })
    };
    const onError = jest.fn()
      .mockImplementationOnce(() => { throw new Error('reporting failed'); })
      .mockImplementation(() => undefined);

    const { latest, flush } = await renderHook(() => useCanaLiveQuery<Row>({
      client: client as never,
      store: 'rows',
      query: { limit: 10 },
      onError
    }));
    expect(latest.current.status).toBe('ready');
    expect(onError).not.toHaveBeenCalled();

    await act(async () => { broker.emit({}); });
    await flush();

    expect(onError.mock.calls.map(([error]) => (error as Error).message))
      .toStrictEqual(['query refused', 'reporting failed']);
    expect(latest.current.status).toBe('error');
  });
});
