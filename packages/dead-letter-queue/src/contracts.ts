/**
 * JUM-53 — transactions rejected because the mutex held the resource.
 *
 * A write refused for contention is not a failed write: it is a write that has
 * not happened yet. Throwing and forgetting makes the two indistinguishable,
 * which is the defect this package exists to fix.
 */

/**
 * Where a record is in its life.
 *
 * `pending` is replayable. `succeeded` and `abandoned` are terminal, and are
 * kept rather than deleted so that "the write never happened" stays answerable
 * after the fact.
 */
export type DeadLetterStatus = 'pending' | 'succeeded' | 'abandoned';

/**
 * A rejected transaction, carrying everything a replay needs.
 *
 * `payload` is the arguments of the original call, not the HTTP request: a
 * replay runs through the service, so nothing about the transport is required
 * and nothing about the transport is stored.
 */
export interface DeadLetterRecord<TPayload = unknown> {
  id: string;
  entityName: string;
  resourceId: string;
  operation: string;
  payload: TPayload;
  actorId?: string;
  createdAt: string;
  updatedAt: string;
  attempts: number;
  status: DeadLetterStatus;
  lastError?: string;
}

/** The fields a caller supplies; the queue owns the rest. */
export interface DeadLetterInput<TPayload = unknown> {
  entityName: string;
  resourceId: string;
  operation: string;
  payload: TPayload;
  actorId?: string;
}

/**
 * Persistence for records.
 *
 * Deliberately narrow, and deliberately not a scan: the Redis client this runs
 * against exposes `get`/`set`/`del` only, so the store keeps its own index
 * rather than pretending a key space can be enumerated.
 */
export interface IDeadLetterStore {
  put(record: DeadLetterRecord): Promise<void>;
  get(id: string): Promise<DeadLetterRecord | undefined>;
  list(): Promise<DeadLetterRecord[]>;
}

/**
 * Performs the original operation again.
 *
 * Returning normally means the write happened. Throwing means it did not, and
 * the record stays replayable until the attempt bound is reached — including
 * when the throw is another `ResourceLockedError`.
 */
export type DeadLetterReplayHandler<TPayload = unknown> = (
  record: DeadLetterRecord<TPayload>
) => Promise<void>;

/** Outcome of one drain, reported per record rather than as a total. */
export interface DeadLetterReplayReport {
  replayed: string[];
  retried: string[];
  abandoned: string[];
  skipped: string[];
}

export interface IDeadLetterQueue {
  enqueue<TPayload>(input: DeadLetterInput<TPayload>): Promise<DeadLetterRecord<TPayload>>;
  pending(): Promise<DeadLetterRecord[]>;
  replay(handlers: Record<string, DeadLetterReplayHandler>): Promise<DeadLetterReplayReport>;
}
