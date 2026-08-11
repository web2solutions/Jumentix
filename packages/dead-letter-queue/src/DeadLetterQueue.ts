import { InMemoryDeadLetterStore } from './InMemoryDeadLetterStore';
import type {
  DeadLetterInput,
  DeadLetterRecord,
  DeadLetterReplayHandler,
  DeadLetterReplayReport,
  IDeadLetterQueue,
  IDeadLetterStore
} from './contracts';

export interface IDeadLetterQueueOptions {
  store?: IDeadLetterStore;
  maxAttempts?: number;
  now?: () => Date;
  newId?: () => string;
}

const DEFAULT_MAX_ATTEMPTS = 5;

/**
 * JUM-53 — the queue of writes the mutex refused.
 *
 * Two properties matter more than anything else here:
 *
 *  - **Enqueueing never reports success to the caller.** The service still
 *    throws `ResourceLockedError`. A queued write has not happened, and a
 *    client told otherwise would act on a lie.
 *  - **Replay is bounded.** A resource whose lock never clears would otherwise
 *    be retried for ever, which turns a stuck write into a permanent load. At
 *    `maxAttempts` the record becomes `abandoned` and is never picked again.
 */
export class DeadLetterQueue implements IDeadLetterQueue {
  private readonly store: IDeadLetterStore;

  private readonly maxAttempts: number;

  private readonly now: () => Date;

  private readonly newId: () => string;

  private sequence = 0;

  public constructor({
    store = new InMemoryDeadLetterStore(),
    maxAttempts = DEFAULT_MAX_ATTEMPTS,
    now = () => new Date(),
    newId
  }: IDeadLetterQueueOptions = {}) {
    if (maxAttempts < 1) throw new Error('DeadLetterQueue requires maxAttempts of at least 1');
    this.store = store;
    this.maxAttempts = maxAttempts;
    this.now = now;
    // Two records enqueued in the same millisecond must not collide, so the
    // default id carries a counter rather than the timestamp alone.
    this.newId = newId ?? (() => {
      this.sequence += 1;
      return `dlq-${this.now().getTime()}-${this.sequence}`;
    });
  }

  public async enqueue<TPayload>(
    input: DeadLetterInput<TPayload>
  ): Promise<DeadLetterRecord<TPayload>> {
    if (!input.entityName) throw new Error('DeadLetterQueue.enqueue requires entityName');
    if (!input.resourceId) throw new Error('DeadLetterQueue.enqueue requires resourceId');
    if (!input.operation) throw new Error('DeadLetterQueue.enqueue requires operation');

    const timestamp = this.now().toISOString();
    const record: DeadLetterRecord<TPayload> = {
      id: this.newId(),
      entityName: input.entityName,
      resourceId: input.resourceId,
      operation: input.operation,
      payload: input.payload,
      createdAt: timestamp,
      updatedAt: timestamp,
      attempts: 0,
      status: 'pending',
      ...(input.actorId ? { actorId: input.actorId } : {})
    };

    await this.store.put(record as DeadLetterRecord);
    return record;
  }

  public async pending(): Promise<DeadLetterRecord[]> {
    const records = await this.store.list();
    return records.filter((record) => record.status === 'pending');
  }

  public async find(id: string): Promise<DeadLetterRecord | undefined> {
    return this.store.get(id);
  }

  /**
   * Drain the pending records once.
   *
   * A record whose operation has no handler is **skipped**, not abandoned: an
   * unregistered handler is a wiring mistake in this process, and discarding a
   * pending write because of one would lose exactly the data this exists to
   * keep.
   */
  public async replay(
    handlers: Record<string, DeadLetterReplayHandler>
  ): Promise<DeadLetterReplayReport> {
    const report: DeadLetterReplayReport = {
      replayed: [], retried: [], abandoned: [], skipped: []
    };

    /* eslint-disable no-await-in-loop --
     * Sequential by requirement, not by oversight. Two writes rejected on the
     * same resource have to be replayed in the order they were attempted, and
     * resolving them concurrently would apply them in completion order —
     * letting the earlier value win, silently. */
    for (const record of await this.pending()) {
      const handler = handlers[record.operation];
      if (handler) {
        await this.attempt(record, handler, report);
      } else {
        report.skipped.push(record.id);
      }
    }
    /* eslint-enable no-await-in-loop */

    return report;
  }

  private async attempt(
    record: DeadLetterRecord,
    handler: DeadLetterReplayHandler,
    report: DeadLetterReplayReport
  ): Promise<void> {
    try {
      await handler(record);
      await this.settle(record, 'succeeded');
      report.replayed.push(record.id);
    } catch (error: unknown) {
      const attempts = record.attempts + 1;
      const detail = error instanceof Error ? error.message : String(error);
      if (attempts >= this.maxAttempts) {
        await this.settle({ ...record, attempts }, 'abandoned', detail);
        report.abandoned.push(record.id);
        return;
      }
      await this.store.put({
        ...record, attempts, updatedAt: this.now().toISOString(), lastError: detail
      });
      report.retried.push(record.id);
    }
  }

  private async settle(
    record: DeadLetterRecord,
    status: DeadLetterRecord['status'],
    lastError?: string
  ): Promise<void> {
    await this.store.put({
      ...record,
      status,
      updatedAt: this.now().toISOString(),
      ...(lastError ? { lastError } : {})
    });
  }
}
