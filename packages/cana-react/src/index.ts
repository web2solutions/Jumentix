import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import type {
  CanaChangeEvent,
  CanaClient,
  CanaQuery
} from '@jumentix/cana';
import {
  applyCanaEventToRecords,
  type CanaCollectionOptions,
  type CanaRecordKeyReader
} from './collection';

export type { CanaCollectionOptions, CanaRecordKeyReader };
export { applyCanaEventToRecords };

export type CanaHookStatus = 'idle' | 'opening' | 'loading' | 'ready' | 'error';

export type UseCanaClientResult<TClient extends CanaClient> = {
  client: TClient | null;
  status: CanaHookStatus;
  error: unknown;
};

export function useCanaClient<TClient extends CanaClient>(
  create: () => TClient | Promise<TClient>,
  deps: readonly unknown[] = []
): UseCanaClientResult<TClient> {
  const [client, setClient] = useState<TClient | null>(null);
  const [status, setStatus] = useState<CanaHookStatus>('idle');
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let alive = true;
    let opened: TClient | null = null;

    setStatus('opening');
    setError(null);

    Promise.resolve(create())
      .then(async (next) => {
        opened = next;
        await next.open();
        if (!alive) {
          await next.close();
          return;
        }
        setClient(next);
        setStatus('ready');
      })
      .catch((err) => {
        if (!alive) return;
        setError(err);
        setStatus('error');
      });

    return () => {
      alive = false;
      setClient(null);
      if (opened) {
        opened.close().catch(() => undefined);
      }
    };
  }, deps);

  return { client, status, error };
}

export type UseCanaSubscriptionOptions = {
  enabled?: boolean;
  sinceCursor?: number;
  onError?: (error: unknown) => void;
};

export function useCanaSubscription(
  client: CanaClient | null | undefined,
  listener: (event: CanaChangeEvent) => void,
  options: UseCanaSubscriptionOptions = {}
): void {
  const listenerRef = useRef(listener);
  listenerRef.current = listener;

  useEffect(() => {
    if (!client || options.enabled === false) return undefined;
    try {
      return client.subscribe(
        (event) => listenerRef.current(event),
        options.sinceCursor === undefined ? undefined : { sinceCursor: options.sinceCursor }
      );
    } catch (error) {
      options.onError?.(error);
      return undefined;
    }
  }, [client, options.enabled, options.sinceCursor, options.onError]);
}

export type UseCanaLiveQueryOptions<TRecord> = {
  client: CanaClient | null | undefined;
  store: string;
  query?: CanaQuery;
  enabled?: boolean;
  getKey?: CanaRecordKeyReader<TRecord>;
  sort?: (a: TRecord, b: TRecord) => number;
  reloadOnEvent?: boolean;
  onError?: (error: unknown) => void;
};

export type UseCanaLiveQueryResult<TRecord> = {
  records: TRecord[];
  status: CanaHookStatus;
  error: unknown;
  reload: () => Promise<TRecord[]>;
};

export function useCanaLiveQuery<TRecord>(
  options: UseCanaLiveQueryOptions<TRecord>
): UseCanaLiveQueryResult<TRecord> {
  const {
    client,
    store,
    enabled = true,
    getKey,
    sort,
    onError
  } = options;
  const queryKey = JSON.stringify(options.query ?? null);
  const query = useMemo(() => options.query, [queryKey]);
  const reloadOnEvent = options.reloadOnEvent ?? Boolean(options.query);
  const [records, setRecords] = useState<TRecord[]>([]);
  const [status, setStatus] = useState<CanaHookStatus>('idle');
  const [error, setError] = useState<unknown>(null);

  const reload = useCallback(async () => {
    if (!client || !enabled) return [];
    setStatus('loading');
    setError(null);
    try {
      const next = [...await client.table<TRecord>(store).query(query)];
      if (sort) next.sort(sort);
      setRecords(next);
      setStatus('ready');
      return next;
    } catch (err) {
      setError(err);
      setStatus('error');
      onError?.(err);
      return [];
    }
  }, [client, enabled, onError, query, sort, store]);

  useEffect(() => {
    if (!client || !enabled) return undefined;
    let alive = true;
    const safeReload = async () => {
      if (!alive) return;
      await reload();
    };
    safeReload().catch((err) => onError?.(err));

    const stop = client.subscribe((event) => {
      if (event.store !== store) return;
      if (reloadOnEvent) {
        safeReload().catch((err) => onError?.(err));
        return;
      }
      const collectionOptions: CanaCollectionOptions<TRecord> = {
        store,
        getKey,
        sort
      };
      setRecords((current) => applyCanaEventToRecords(current, event, collectionOptions));
    });

    return () => {
      alive = false;
      stop();
    };
  }, [client, enabled, getKey, reload, reloadOnEvent, sort, store]);

  return {
    records,
    status,
    error,
    reload
  };
}
