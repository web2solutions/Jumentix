export interface ICacheService {
  get<T = any>(key: string): Promise<T | undefined>;
  set<T = any>(key: string, value: T, ttlInSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
  getVersion(namespace: string): Promise<number>;
  bumpVersion(namespace: string): Promise<number>;
}
