import type { DeadLetterReplayHandler, DeadLetterReplayReport, IDeadLetterQueue } from './contracts';

export interface IDeadLetterReplayWorkerOptions {
  queue: IDeadLetterQueue;
  handlers: Record<string, DeadLetterReplayHandler>;
  intervalMs?: number;
  onReport?: (report: DeadLetterReplayReport) => void;
  onError?: (error: unknown) => void;
  setIntervalFn?: typeof setInterval;
  clearIntervalFn?: typeof clearInterval;
}

const DEFAULT_INTERVAL_MS = 30_000;

/**
 * JUM-53 — the thing that actually calls `replay`.
 *
 * A queue nothing drains is a slower way of losing the write. This runs the
 * drain on an interval and is the piece that turns the record into a retry.
 *
 * Three properties it has to hold, each of which is a way a naive timer loop
 * goes wrong:
 *
 *  - **No overlap.** A drain slower than the interval must not be started
 *    again while the previous one is still running, or the same record is
 *    replayed twice concurrently — the duplicate write this whole design
 *    exists to avoid.
 *  - **A failing drain does not stop the worker.** If Redis is down, the tick
 *    fails and the next tick still happens. A worker that dies on the first
 *    error is indistinguishable from one that was never started.
 *  - **Stopping is complete.** After `stop()` no further tick runs, including
 *    one already scheduled.
 */
export class DeadLetterReplayWorker {
  private readonly queue: IDeadLetterQueue;

  private readonly handlers: Record<string, DeadLetterReplayHandler>;

  private readonly intervalMs: number;

  private readonly onReport?: (report: DeadLetterReplayReport) => void;

  private readonly onError?: (error: unknown) => void;

  private readonly setIntervalFn: typeof setInterval;

  private readonly clearIntervalFn: typeof clearInterval;

  private timer?: ReturnType<typeof setInterval>;

  private draining = false;

  public constructor({
    queue,
    handlers,
    intervalMs = DEFAULT_INTERVAL_MS,
    onReport,
    onError,
    setIntervalFn = setInterval,
    clearIntervalFn = clearInterval
  }: IDeadLetterReplayWorkerOptions) {
    if (!queue) throw new Error('DeadLetterReplayWorker requires a queue');
    if (!handlers || Object.keys(handlers).length === 0) {
      // A worker with no handlers would drain nothing and report success for
      // ever, which reads exactly like a working one.
      throw new Error('DeadLetterReplayWorker requires at least one handler');
    }
    if (intervalMs < 1) throw new Error('DeadLetterReplayWorker requires a positive intervalMs');

    this.queue = queue;
    this.handlers = handlers;
    this.intervalMs = intervalMs;
    this.onReport = onReport;
    this.onError = onError;
    this.setIntervalFn = setIntervalFn;
    this.clearIntervalFn = clearIntervalFn;
  }

  public get running(): boolean {
    return this.timer !== undefined;
  }

  public start(): void {
    if (this.timer) return;
    this.timer = this.setIntervalFn(() => { this.tick().catch(() => undefined); }, this.intervalMs);
    // Node keeps the process alive for a pending timer. A background drain is
    // not a reason for a CLI or a test runner to hang, which is the leaked
    // handle this repository has been bitten by before.
    (this.timer as unknown as { unref?: () => void }).unref?.();
  }

  public stop(): void {
    if (!this.timer) return;
    this.clearIntervalFn(this.timer);
    this.timer = undefined;
  }

  /**
   * One drain. Public so a caller can force one — on shutdown, or on the
   * unlock of a resource — without waiting for the interval.
   */
  public async tick(): Promise<DeadLetterReplayReport | undefined> {
    if (this.draining) return undefined;
    this.draining = true;
    try {
      const report = await this.queue.replay(this.handlers);
      this.onReport?.(report);
      return report;
    } catch (error: unknown) {
      this.onError?.(error);
      return undefined;
    } finally {
      this.draining = false;
    }
  }
}
