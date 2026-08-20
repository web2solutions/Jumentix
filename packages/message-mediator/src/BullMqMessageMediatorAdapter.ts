import { randomUUID } from 'node:crypto';
import type {
  IIntegrationEvent,
  IMessage,
  IMessageHandlerRegistrationOptions,
  IMessageMediator,
  IMessageRequestOptions,
  IMessageResponse,
  MessageHandler
} from './contracts';

interface IBullMqMediatorOptions {
  connection: Record<string, any>;
  defaultRequestQueue?: string;
}

interface IRegisteredHandler {
  handler: MessageHandler<any, any>;
  options?: IMessageHandlerRegistrationOptions;
}

export class BullMqMessageMediatorAdapter implements IMessageMediator {
  private readonly defaultRequestQueue: string;

  private initialized = false;

  private readonly eventListeners: Record<
    string,
    Array<(event: IIntegrationEvent) => Promise<void> | void>
  > = {};

  private readonly handlersByContract: Record<string, IRegisteredHandler> = {};

  private readonly handlersByRouteKey: Record<string, IRegisteredHandler> = {};

  private readonly handlersByQueueName: Record<string, IRegisteredHandler> = {};

  private bullmq: any;

  private queuesByName: Record<string, any> = {};

  private queueEventsByName: Record<string, any> = {};

  private workersByName: Record<string, any> = {};

  private infrastructureReadyByName: Record<string, Promise<void>> = {};

  public constructor(private readonly options: IBullMqMediatorOptions) {
    this.defaultRequestQueue = options.defaultRequestQueue ?? 'app.requests';
  }

  public async connect(): Promise<void> {
    if (this.initialized) {
      return;
    }
    this.bullmq = await BullMqMessageMediatorAdapter.loadBullMq();
    await this.ensureQueueInfrastructure(this.defaultRequestQueue);
    this.initialized = true;
  }

  public async disconnect(): Promise<void> {
    const infrastructureReady = Object.values(this.infrastructureReadyByName);
    await Promise.allSettled(infrastructureReady);

    const workers = Object.values(this.workersByName);
    const queues = Object.values(this.queuesByName);
    const queueEvents = Object.values(this.queueEventsByName);

    await Promise.all(workers.map(async (worker: any) => worker.close()));
    await Promise.all(queues.map(async (queue: any) => queue.close()));
    await Promise.all(queueEvents.map(async (events: any) => events.close()));

    this.workersByName = {};
    this.queuesByName = {};
    this.queueEventsByName = {};
    this.infrastructureReadyByName = {};
    this.initialized = false;
  }

  public async publish(event: IIntegrationEvent): Promise<void> {
    await this.ensureConnected();
    const listeners = this.eventListeners[event.name] || [];
    await Promise.all(listeners.map(async (listener) => listener(event)));

    const eventQueueName = `events.${event.name}`;
    await this.ensureQueueInfrastructure(eventQueueName);
    await this.queuesByName[eventQueueName].add(event.name, event, {
      removeOnComplete: true
    });
  }

  public subscribe(
    eventName: string,
    listener: (event: IIntegrationEvent) => Promise<void> | void
  ): void {
    if (!this.eventListeners[eventName]) {
      this.eventListeners[eventName] = [];
    }
    this.eventListeners[eventName].push(listener);
  }

  public registerHandler<TPayload = any, TResult = any>(
    contract: string,
    handler: MessageHandler<TPayload, TResult>,
    options?: IMessageHandlerRegistrationOptions
  ): void {
    const registration: IRegisteredHandler = {
      handler: handler as MessageHandler<any, any>,
      options
    };
    this.handlersByContract[contract] = registration;
    if (options?.routeKey) {
      this.handlersByRouteKey[options.routeKey] = registration;
    }
    if (options?.queueName) {
      this.handlersByQueueName[options.queueName] = registration;
    }
  }

  public async request<TPayload = any, TResult = any>(
    message: IMessage<TPayload>,
    options?: IMessageRequestOptions
  ): Promise<IMessageResponse<TResult>> {
    await this.ensureConnected();

    const queueName = options?.queueName ?? this.defaultRequestQueue;
    await this.ensureQueueInfrastructure(queueName);

    const correlationId = message.metadata?.correlationId ?? randomUUID();
    const timeoutMs = options?.timeoutMs ?? 15000;
    const routeKey = options?.routeKey ?? message.contract;

    const job = await this.queuesByName[queueName].add(
      routeKey,
      {
        message: {
          ...message,
          metadata: {
            ...message.metadata,
            correlationId
          }
        },
        options: {
          ...options,
          routeKey
        }
      },
      BullMqMessageMediatorAdapter.retentionFor(timeoutMs)
    );

    try {
      const response = await job.waitUntilFinished(this.queueEventsByName[queueName], timeoutMs);
      return response as IMessageResponse<TResult>;
    } catch (error) {
      return {
        contract: message.contract,
        version: message.version,
        metadata: message.metadata,
        error: BullMqMessageMediatorAdapter.requestFailure(error, timeoutMs)
      };
    }
  }

  /**
   * How long a finished job has to survive for the caller to read its result.
   *
   * `removeOnComplete: true` deletes the job the instant the worker finishes.
   * `waitUntilFinished` subscribes to the completion event and then polls
   * `isFinished` **once** to cover the case where the job finished before the
   * subscription existed. With the job already deleted that poll returns
   * `Missing key for job <id>. isFinished` and the wait rejects — so a request
   * whose handler answered correctly comes back as a failure. It is a race
   * between the worker and the caller, which is why it surfaced as an
   * intermittent test (JUM-621) rather than a broken feature.
   *
   * Measured against a real Redis: with a 300ms head start for the worker,
   * `removeOnComplete: true` rejects in 3ms with the missing-key error, and
   * `{ age }` resolves with the handler's value.
   *
   * The retention window is the request timeout, because nothing waits for a
   * reply after that, with a floor for very short timeouts and a count cap so a
   * busy queue cannot grow without bound.
   */
  private static retentionFor(timeoutMs: number) {
    const age = Math.max(60, Math.ceil(timeoutMs / 1000));
    return {
      removeOnComplete: { age, count: 1000 },
      removeOnFail: { age, count: 1000 }
    };
  }

  /**
   * The failure the caller is told about is the failure that happened.
   *
   * This used to report every rejection as `timed out after ${timeoutMs}ms`,
   * including the missing-key rejection above — which arrives in single-digit
   * milliseconds. The message named a duration that had not elapsed and a cause
   * that was not the cause, and JUM-621 was filed against the test on the
   * strength of it.
   */
  private static requestFailure(error: unknown, timeoutMs: number): Error {
    const detail = error instanceof Error ? error.message : String(error);
    if (detail.includes('timed out before finishing')) {
      return new Error(`Message request timed out after ${timeoutMs}ms`);
    }
    return new Error(`Message request failed: ${detail}`);
  }

  private async ensureConnected(): Promise<void> {
    if (!this.initialized) {
      await this.connect();
    }
  }

  private async ensureQueueInfrastructure(queueName: string): Promise<void> {
    if (!this.infrastructureReadyByName[queueName]) {
      this.infrastructureReadyByName[queueName] = this.createQueueInfrastructure(queueName)
        .catch((error) => {
          delete this.infrastructureReadyByName[queueName];
          throw error;
        });
    }

    await this.infrastructureReadyByName[queueName];
  }

  private async createQueueInfrastructure(queueName: string): Promise<void> {
    let queue = this.queuesByName[queueName];
    let queueEvents = this.queueEventsByName[queueName];
    let worker = this.workersByName[queueName];
    const created: Array<{ close: () => Promise<void> }> = [];

    try {
      if (!queue) {
        const { Queue } = this.bullmq;
        queue = new Queue(queueName, {
          connection: this.options.connection
        });
        this.queuesByName[queueName] = queue;
        created.push(queue);
      }

      if (!queueEvents) {
        const { QueueEvents } = this.bullmq;
        queueEvents = new QueueEvents(queueName, {
          connection: this.options.connection
        });
        this.queueEventsByName[queueName] = queueEvents;
        created.push(queueEvents);
        await queueEvents.waitUntilReady();
      }

      if (!worker) {
        const { Worker } = this.bullmq;
        worker = new Worker(
          queueName,
          async (job: any) => {
            const inputMessage = job.data.message as IMessage<any>;
            const inputOptions = job.data.options as IMessageRequestOptions;
            return this.resolveRequest(inputMessage, inputOptions);
          },
          {
            connection: this.options.connection
          }
        );
        this.workersByName[queueName] = worker;
        created.push(worker);
        await worker.waitUntilReady();
      }
    } catch (error) {
      await Promise.allSettled(created.map(async (client) => client.close()));
      if (this.queuesByName[queueName] === queue) delete this.queuesByName[queueName];
      if (this.queueEventsByName[queueName] === queueEvents) {
        delete this.queueEventsByName[queueName];
      }
      if (this.workersByName[queueName] === worker) delete this.workersByName[queueName];
      throw error;
    }
  }

  private async resolveRequest<TPayload = any, TResult = any>(
    message: IMessage<TPayload>,
    options?: IMessageRequestOptions
  ): Promise<IMessageResponse<TResult>> {
    const registration = this.resolveHandler(message.contract, options);
    if (!registration) {
      return {
        contract: message.contract,
        version: message.version,
        metadata: message.metadata,
        error: BullMqMessageMediatorAdapter.toWireError(
          new Error(`No handler registered for contract ${message.contract}`)
        )
      };
    }

    try {
      const response = await registration.handler(message);
      return {
        ...response,
        contract: response.contract ?? message.contract,
        version: response.version ?? message.version,
        metadata: response.metadata ?? message.metadata
      } as IMessageResponse<TResult>;
    } catch (error) {
      return {
        contract: message.contract,
        version: message.version,
        metadata: message.metadata,
        error: BullMqMessageMediatorAdapter.toWireError(error)
      };
    }
  }

  /**
   * BullMQ persists the worker return value as JSON. A native `Error` becomes
   * `{}` on the wire, so the caller would learn only that "something" failed.
   * A plain `{ name, message }` survives Redis and still reads as an error.
   */
  private static toWireError(error: unknown): Error {
    if (error instanceof Error) {
      return { name: error.name, message: error.message } as Error;
    }
    return { name: 'Error', message: String(error) } as Error;
  }

  private resolveHandler(
    contract: string,
    options?: IMessageRequestOptions
  ): IRegisteredHandler | undefined {
    if (options?.routeKey && this.handlersByRouteKey[options.routeKey]) {
      return this.handlersByRouteKey[options.routeKey];
    }
    if (options?.queueName && this.handlersByQueueName[options.queueName]) {
      return this.handlersByQueueName[options.queueName];
    }
    return this.handlersByContract[contract];
  }

  /**
   * Import seam for the BullMQ package.
   *
   * Overridable in suites so the missing-package catch is measurable without
   * uninstalling a dependency from the workspace (JUM-583: no module mock).
   */
  public static importBullMq: () => Promise<any> = async () => import('bullmq');

  private static async loadBullMq(): Promise<any> {
    try {
      return await BullMqMessageMediatorAdapter.importBullMq();
    } catch (error) {
      const err = new Error(
        'BullMQ adapter requires package "bullmq". Install with: bun add bullmq'
      );
      (err as any).cause = error as Error;
      throw err;
    }
  }
}
