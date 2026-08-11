import {
  DeadLetterQueue,
  DeadLetterReplayWorker,
  KeyValueDeadLetterStore,
  type DeadLetterReplayHandler,
  type DeadLetterRecord
} from '@jumentix/dead-letter-queue';
import type { IKeyValueStorageClient } from '@src/infra/persistence/KeyValueStorage/IKeyValueStorageClient';
import type { UserService } from '@src/modules/Users/service/UserService';

/**
 * JUM-53 — replay the writes the mutex refused, through the same service.
 *
 * Replaying through `UserService` rather than the repository is deliberate: the
 * service re-acquires the mutex, so a record whose lock has not cleared is
 * refused again and stays queued. A repository-level replay would write past
 * the lock, which is the corruption the mutex exists to prevent.
 */

/** The service methods that can refuse a write for a lock, by operation name. */
type AggregatePayload = {
  documentId?: string;
  phoneId?: string;
  emailId?: string;
  data?: unknown;
};

/**
 * The service reports failure in `response.error` and does not throw.
 *
 * That is the false green in this design: a replay of a still-locked record
 * would return a response, the handler would return normally, and the queue
 * would mark it `succeeded` — losing the write while reporting that it landed.
 * Every handler goes through here.
 */
async function orThrow(
  operation: () => Promise<{ error?: unknown }>
): Promise<void> {
  const response = await operation();
  if (response?.error) {
    const error = response.error as Error;
    throw error instanceof Error ? error : new Error(String(error));
  }
}

export function userReplayHandlers(
  userService: UserService
): Record<string, DeadLetterReplayHandler> {
  const service = userService as unknown as Record<
    string, (...args: unknown[]) => Promise<{ error?: unknown }>
  >;
  const of = (record: DeadLetterRecord) => (record.payload ?? {}) as AggregatePayload;

  /** `payload` is the whole argument: `update`, `updatePassword`, `create*`. */
  const whole = (method: string): DeadLetterReplayHandler => (
    (record) => orThrow(() => service[method](record.resourceId, record.payload))
  );

  /** `payload` names a child and carries its data: `update{Document,Phone,Email}`. */
  const child = (method: string, key: keyof AggregatePayload): DeadLetterReplayHandler => (
    (record) => orThrow(() => service[method](record.resourceId, of(record)[key], of(record).data))
  );

  /** `payload` names a child only: `delete{Document,Phone,Email}`. */
  const target = (method: string, key: keyof AggregatePayload): DeadLetterReplayHandler => (
    (record) => orThrow(() => service[method](record.resourceId, of(record)[key]))
  );

  return {
    update: whole('update'),
    delete: (record) => orThrow(() => service.delete(record.resourceId)),
    updatePassword: whole('updatePassword'),
    createDocument: whole('createDocument'),
    updateDocument: child('updateDocument', 'documentId'),
    deleteDocument: target('deleteDocument', 'documentId'),
    createPhone: whole('createPhone'),
    updatePhone: child('updatePhone', 'phoneId'),
    deletePhone: target('deletePhone', 'phoneId'),
    createEmail: whole('createEmail'),
    updateEmail: child('updateEmail', 'emailId'),
    deleteEmail: target('deleteEmail', 'emailId')
  };
}

/**
 * The queue, backed by the same store the mutex uses.
 *
 * Without a key-value client there is no shared store, and a process-local
 * queue would be lost on restart while looking like durability. Returning
 * `undefined` keeps the service on its previous behaviour instead.
 */
export function composeUserDeadLetterQueue(
  keyValueStorageClient?: IKeyValueStorageClient
): DeadLetterQueue | undefined {
  if (!keyValueStorageClient) return undefined;
  return new DeadLetterQueue({
    store: new KeyValueDeadLetterStore(keyValueStorageClient as never)
  });
}

export function composeUserDeadLetterWorker(
  queue: DeadLetterQueue | undefined,
  userService: UserService,
  intervalMs?: number
): DeadLetterReplayWorker | undefined {
  if (!queue) return undefined;
  return new DeadLetterReplayWorker({
    queue,
    handlers: userReplayHandlers(userService),
    ...(intervalMs ? { intervalMs } : {}),
    onError: (error) => {
      // eslint-disable-next-line no-console
      console.error('[dead-letter] replay drain failed', error);
    }
  });
}
