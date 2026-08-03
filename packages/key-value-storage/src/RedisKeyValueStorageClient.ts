/* eslint-disable no-console */
import {
  createClient
} from 'redis';

import type { IServiceResponse } from './contracts';
import { ServiceResponse } from './ServiceResponse';
import { BaseKeyValueStorageClient } from './BaseKeyValueStorageClient';

let redisKeyValueStorageClient: BaseKeyValueStorageClient | undefined;

const DEFAULT_REDIS_CONNECT_TIMEOUT_MS = 5000;
const DEFAULT_REDIS_MAX_RECONNECT_ATTEMPTS = 3;

/**
 * Clears the singleton so a suite can rebuild against another Redis endpoint.
 * Production callers must not use this — a second client would orphan locks and
 * subscriptions held on the first.
 */
export function resetRedisKeyValueStorageClientForTests(): void {
  redisKeyValueStorageClient = undefined;
}

/**
 * A positive integer from the environment, or the fallback when the value is
 * missing, non-numeric, zero or negative. A bounded client that silently
 * ignores a malformed timeout is better than one that refuses to boot.
 */
const resolvePositiveInteger = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const resolveRedisConfig = (): Record<string, any> => {
  const socketPort = Number(process.env.JUMENTIX_REDIS_PORT || 6379);
  const connectTimeoutMs = resolvePositiveInteger(
    process.env.JUMENTIX_REDIS_CONNECT_TIMEOUT_MS,
    DEFAULT_REDIS_CONNECT_TIMEOUT_MS
  );
  const maxReconnectAttempts = resolvePositiveInteger(
    process.env.JUMENTIX_REDIS_MAX_RECONNECT_ATTEMPTS,
    DEFAULT_REDIS_MAX_RECONNECT_ATTEMPTS
  );
  return {
    socket: {
      host: process.env.JUMENTIX_REDIS_HOST || '127.0.0.1',
      port: Number.isFinite(socketPort) ? socketPort : 6379,
      connectTimeout: connectTimeoutMs,
      /**
       * `redis` reconnects with exponential backoff and no ceiling by default,
       * so an unreachable server made every call wait forever. This strategy
       * bounds the wait: a fixed number of retries with a capped backoff, then
       * an Error that rejects `connect()` — which the callers report as a
       * `ServiceResponse.error` instead of hanging.
       */
      reconnectStrategy: (retries: number): number | Error => {
        if (retries >= maxReconnectAttempts) {
          return new Error(`Redis connection failed after ${maxReconnectAttempts} reconnect attempt(s).`);
        }
        return Math.min(2 ** retries * 100, 1000);
      }
    },
    username: process.env.JUMENTIX_REDIS_USERNAME || undefined,
    password: process.env.JUMENTIX_REDIS_PASSWORD || undefined,
    database: Number(process.env.JUMENTIX_REDIS_DB || 0)
  };
};

export class RedisKeyValueStorageClient extends BaseKeyValueStorageClient {
  public client: ReturnType<typeof createClient>;

  public connected: boolean;

  private constructor(config: Record<string, any> = resolveRedisConfig()) {
    super();
    this.client = createClient(config as any);
    this.client.on('error', (err) => console.log('Redis Client Error', err));
    this.client.on('connect', () => {
      this.connected = true;
    });
    this.client.on('end', () => {
      this.connected = false;
    });
    this.connected = false;
  }

  /**
   * A fresh client with an explicit configuration, used by tests that need a
   * bounded, unreachable endpoint. `compile()` remains the only path that
   * hands out the shared singleton.
   */
  public static create(
    config: Record<string, any> = resolveRedisConfig()
  ): RedisKeyValueStorageClient {
    return new RedisKeyValueStorageClient(config);
  }

  public async get(keyName: string): Promise<IServiceResponse> {
    const connection = await this.connect();
    if (connection.error) {
      return connection;
    }
    try {
      const result = await this.client.get(`${this.prefix}:${keyName}`);
      return new ServiceResponse({ result });
    } catch (error: unknown) {
      return new ServiceResponse({ error: error as Error });
    }
  }

  public async del(keyName: string): Promise<IServiceResponse> {
    const connection = await this.connect();
    if (connection.error) {
      return connection;
    }
    try {
      const result = await this.client.del(`${this.prefix}:${keyName}`);
      return new ServiceResponse({ result });
    } catch (error: unknown) {
      return new ServiceResponse({ error: error as Error });
    }
  }

  public async set(keyName: string, value: any): Promise<IServiceResponse> {
    const connection = await this.connect();
    if (connection.error) {
      return connection;
    }
    try {
      const result = await this.client.set(`${this.prefix}:${keyName}`, value);
      return new ServiceResponse({ result });
    } catch (error: unknown) {
      return new ServiceResponse({ error: error as Error });
    }
  }

  public async disconnect(): Promise<IServiceResponse> {
    try {
      await this.client.quit();
      this.connected = false;
      return new ServiceResponse({
        result: {
          connected: this.connected
        }
      });
    } catch (error: unknown) {
      return new ServiceResponse({ error: error as Error });
    }
  }

  public async connect(): Promise<IServiceResponse> {
    try {
      if (!this.connected) {
        await this.client.connect();
        this.connected = true;
      }
      return new ServiceResponse({
        result: {
          connected: this.connected
        }
      });
    } catch (error: unknown) {
      return new ServiceResponse({ error: error as Error });
    }
  }

  public static compile(): RedisKeyValueStorageClient {
    if (redisKeyValueStorageClient) {
      return redisKeyValueStorageClient as RedisKeyValueStorageClient;
    }
    redisKeyValueStorageClient = new RedisKeyValueStorageClient();
    return redisKeyValueStorageClient as RedisKeyValueStorageClient;
  }
}
