import type { DbChoice, HttpInterface, RealtimeInterface } from '../sources/types';

/** Integration suite folder names under `test/integration/` (seed layout). */
export const HTTP_INTEGRATION_SUITES: Record<HttpInterface, string> = {
  express: 'Express',
  fastify: 'Fastify',
  restify: 'Restify'
};

/** All HTTP integration suite folders present on the backend seed. */
export const ALL_HTTP_INTEGRATION_SUITES = Object.freeze([
  'Adonis-JS',
  'Cloudflare-Workers',
  'Derby-JS',
  'Express',
  'Fastify',
  'Feathers',
  'Lambda',
  'LoopBack',
  'Restify',
  'Sails-JS',
  'Total-JS',
  'Vercel-Functions'
]);

/** Compose files kept regardless of db choice (cache / shared infra). */
export const ALWAYS_KEEP_COMPOSE_FILES = Object.freeze([
  'docker-compose-redis.yml',
  'docker-compose-messaging.yml',
  'docker-compose-service-templates.yml'
]);

/** Map plan db → seed compose file(s) to retain. */
export const DB_COMPOSE_FILES: Record<DbChoice, readonly string[]> = {
  sqlite: [],
  postgres: ['docker-compose-postgresql.yml'],
  mysql: ['docker-compose-mysql.yml'],
  mongo: ['docker-compose-mongodb.yml'],
  inmemory: []
};

/** All db-scoped compose files that may be pruned. */
export const ALL_DB_COMPOSE_FILES = Object.freeze([
  'docker-compose-aurora.yml',
  'docker-compose-cassandra.yml',
  'docker-compose-dynamodb.yml',
  'docker-compose-firebase.yml',
  'docker-compose-mongodb.yml',
  'docker-compose-mssql.yml',
  'docker-compose-mysql.yml',
  'docker-compose-oracle.yml',
  'docker-compose-postgresql.yml',
  'docker-compose-rds.yml'
]);

export type SlicePlan = {
  http: HttpInterface;
  realtime: RealtimeInterface;
  db: DbChoice;
};

/**
 * Relative paths (posix) under a generated service root that should be removed
 * after the template copy. Runtime adapter code under `src/` is never listed —
 * only integration suites and unused compose files.
 */
export function computeUnusedPaths(slice: SlicePlan): string[] {
  const keepHttp = HTTP_INTEGRATION_SUITES[slice.http];
  const dropHttp = ALL_HTTP_INTEGRATION_SUITES
    .filter((name) => name !== keepHttp)
    .map((name) => `test/integration/${name}`);

  const dropRealtime: string[] = [];
  if (slice.realtime === 'none') {
    dropRealtime.push('test/integration/realtime');
  }

  const keepCompose = new Set<string>([
    ...ALWAYS_KEEP_COMPOSE_FILES,
    ...(DB_COMPOSE_FILES[slice.db] || [])
  ]);
  const dropCompose = ALL_DB_COMPOSE_FILES
    .filter((name) => !keepCompose.has(name));

  return [...dropHttp, ...dropRealtime, ...dropCompose];
}

/**
 * Pure predicate: should this relative path be kept after slicing?
 */
export function shouldKeepRelativePath(relativePath: string, slice: SlicePlan): boolean {
  const normalized = relativePath.replace(/\\/g, '/').replace(/^\.\//, '');
  const unused = new Set(computeUnusedPaths(slice));
  if (unused.has(normalized)) return false;
  // Also drop files nested under unused integration suite dirs.
  for (const prefix of unused) {
    if (normalized === prefix || normalized.startsWith(`${prefix}/`)) {
      return false;
    }
  }
  return true;
}
