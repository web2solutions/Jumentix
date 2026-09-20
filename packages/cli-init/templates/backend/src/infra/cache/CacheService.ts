import type { IKeyValueStorageClient } from '@src/infra/persistence/KeyValueStorage/IKeyValueStorageClient';

import type { ICacheService } from './ICacheService';

interface ICacheEnvelope<T = any> {
  value: T;
  expiresAt?: number;
}

interface ICacheServiceConfig {
  keyValueStorageClient: IKeyValueStorageClient;
}

export class CacheService implements ICacheService {
  private readonly keyValueStorageClient: IKeyValueStorageClient;

  private constructor(config: ICacheServiceConfig) {
    this.keyValueStorageClient = config.keyValueStorageClient;
  }

  public async get<T = any>(key: string): Promise<T | undefined> {
    const { result, error } = await this.keyValueStorageClient.get(key);
    if (error || result === undefined || result === null) return undefined;

    const envelope = result as ICacheEnvelope<T>;
    if (typeof envelope === 'object' && envelope && 'value' in envelope) {
      if (envelope.expiresAt && envelope.expiresAt <= Date.now()) {
        await this.keyValueStorageClient.del(key);
        return undefined;
      }
      return envelope.value;
    }

    return result as T;
  }

  public async set<T = any>(key: string, value: T, ttlInSeconds?: number): Promise<void> {
    const envelope: ICacheEnvelope<T> = { value };
    if (ttlInSeconds && ttlInSeconds > 0) {
      envelope.expiresAt = Date.now() + (ttlInSeconds * 1000);
    }
    await this.keyValueStorageClient.set(key, envelope);
  }

  public async del(key: string): Promise<void> {
    await this.keyValueStorageClient.del(key);
  }

  public async getVersion(namespace: string): Promise<number> {
    const key = CacheService.buildVersionKey(namespace);
    const version = await this.get<number>(key);
    if (!version || Number.isNaN(Number(version)) || Number(version) < 1) {
      await this.set<number>(key, 1);
      return 1;
    }
    return Number(version);
  }

  public async bumpVersion(namespace: string): Promise<number> {
    const key = CacheService.buildVersionKey(namespace);
    const current = await this.getVersion(namespace);
    const next = current + 1;
    await this.set<number>(key, next);
    return next;
  }

  private static buildVersionKey(namespace: string): string {
    return `cache:version:${namespace}`;
  }

  public static compile(config: ICacheServiceConfig): CacheService {
    return new CacheService(config);
  }
}
