import {
  onMounted,
  onUnmounted,
  ref,
  shallowRef,
  type Ref,
  type ShallowRef
} from 'vue';
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

export type CanaVueStatus = 'idle' | 'loading' | 'ready' | 'error';

export type UseCanaSubscriptionOptions = {
  enabled?: boolean;
  sinceCursor?: number;
  onError?: (error: unknown) => void;
};

export function useCanaSubscription(
  client: Ref<CanaClient | null | undefined> | CanaClient | null | undefined,
  listener: (event: CanaChangeEvent) => void,
  options: UseCanaSubscriptionOptions = {}
): { stop: () => void } {
  let stopCurrent = () => {};

  const currentClient = () => (
    client && typeof client === 'object' && 'value' in client
      ? client.value
      : client
  );

  onMounted(() => {
    if (options.enabled === false) return;
    const current = currentClient();
    if (!current) return;
    try {
      stopCurrent = current.subscribe(
        listener,
        options.sinceCursor === undefined ? undefined : { sinceCursor: options.sinceCursor }
      );
    } catch (error) {
      options.onError?.(error);
    }
  });

  onUnmounted(() => {
    stopCurrent();
    stopCurrent = () => {};
  });

  return {
    stop: () => {
      stopCurrent();
      stopCurrent = () => {};
    }
  };
}

export type UseCanaLiveQueryOptions<TRecord> = {
  client: Ref<CanaClient | null | undefined> | CanaClient | null | undefined;
  store: string;
  query?: CanaQuery;
  enabled?: boolean;
  getKey?: CanaRecordKeyReader<TRecord>;
  sort?: (a: TRecord, b: TRecord) => number;
  reloadOnEvent?: boolean;
  onError?: (error: unknown) => void;
};

export type UseCanaLiveQueryResult<TRecord> = {
  records: Ref<TRecord[]>;
  status: Ref<CanaVueStatus>;
  error: ShallowRef<unknown>;
  reload: () => Promise<TRecord[]>;
  stop: () => void;
};

export function useCanaLiveQuery<TRecord>(
  options: UseCanaLiveQueryOptions<TRecord>
): UseCanaLiveQueryResult<TRecord> {
  const records = ref<TRecord[]>([]) as Ref<TRecord[]>;
  const status = ref<CanaVueStatus>('idle');
  const error = shallowRef<unknown>(null);
  let stopCurrent = () => {};
  let alive = true;
  const reloadOnEvent = options.reloadOnEvent ?? Boolean(options.query);

  const currentClient = () => (
    options.client && typeof options.client === 'object' && 'value' in options.client
      ? options.client.value
      : options.client
  );

  const reload = async () => {
    const client = currentClient();
    if (!client || options.enabled === false) return [];
    status.value = 'loading';
    error.value = null;
    try {
      const next = [...await client.table<TRecord>(options.store).query(options.query)];
      if (options.sort) next.sort(options.sort);
      if (alive) {
        records.value = next;
        status.value = 'ready';
      }
      return next;
    } catch (err) {
      if (alive) {
        error.value = err;
        status.value = 'error';
      }
      options.onError?.(err);
      return [];
    }
  };

  onMounted(() => {
    const client = currentClient();
    if (!client || options.enabled === false) return;
    reload().catch((err) => options.onError?.(err));
    stopCurrent = client.subscribe((event) => {
      if (event.store !== options.store) return;
      if (reloadOnEvent) {
        reload().catch((err) => options.onError?.(err));
        return;
      }
      const collectionOptions: CanaCollectionOptions<TRecord> = {
        store: options.store,
        getKey: options.getKey,
        sort: options.sort
      };
      records.value = applyCanaEventToRecords(records.value, event, collectionOptions);
    });
  });

  onUnmounted(() => {
    alive = false;
    stopCurrent();
    stopCurrent = () => {};
  });

  return {
    records,
    status,
    error,
    reload,
    stop: () => {
      stopCurrent();
      stopCurrent = () => {};
    }
  };
}

export type ConnectCanaToPiniaOptions = {
  client: CanaClient;
  apply: (event: CanaChangeEvent) => void;
  sinceCursor?: number;
  onError?: (error: unknown) => void;
};

export function connectCanaToPinia(options: ConnectCanaToPiniaOptions): {
  stop: () => void;
  getLastCursor: () => number;
} {
  let lastCursor = options.sinceCursor ?? 0;
  let stop = () => {};

  try {
    stop = options.client.subscribe((event) => {
      options.apply(event);
      lastCursor = event.cursor;
    }, options.sinceCursor === undefined ? undefined : { sinceCursor: options.sinceCursor });
  } catch (error) {
    options.onError?.(error);
    throw error;
  }

  return {
    stop,
    getLastCursor: () => lastCursor
  };
}
