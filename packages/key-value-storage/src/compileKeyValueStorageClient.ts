import type { IKeyValueStorageClient } from './contracts';
import { InMemoryKeyValueStorageClient } from './InMemoryKeyValueStorageClient';
import { RedisKeyValueStorageClient } from './RedisKeyValueStorageClient';

const normalizeDriver = (value?: string): string => String(value || '').trim().toLowerCase();

export const compileKeyValueStorageClient = (
  driver = process.env.JUMENTIX_KEYVALUESTORAGE_DRIVER
): IKeyValueStorageClient => {
  const normalizedDriver = normalizeDriver(driver);
  if (['inmemory', 'in-memory', 'memory'].includes(normalizedDriver)) {
    return InMemoryKeyValueStorageClient.compile();
  }
  return RedisKeyValueStorageClient.compile();
};
