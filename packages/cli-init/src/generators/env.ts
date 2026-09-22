import type { DbChoice, HttpInterface, RealtimeInterface } from '../sources/types';

/** Runtime env driver names accepted by `@jumentix/database-client-factory`. */
export type EnvDatabaseDriver = 'SQLite' | 'PostgreSQL' | 'MySQL' | 'Mongo' | 'InMemory';

const DB_DRIVER_MAP: Record<DbChoice, EnvDatabaseDriver> = {
  sqlite: 'SQLite',
  postgres: 'PostgreSQL',
  mysql: 'MySQL',
  mongo: 'Mongo',
  inmemory: 'InMemory'
};

/**
 * Map a GenerationPlan db choice to the seed's `JUMENTIX_DATABASE_DRIVER` value.
 */
export function mapDbChoiceToDriver(db: DbChoice): EnvDatabaseDriver {
  return DB_DRIVER_MAP[db] || 'InMemory';
}

/**
 * Map realtime plan choice to seed env pair
 * (`JUMENTIX_REALTIME_API` + `JUMENTIX_REALTIME_API_PROTOCOL`).
 */
export function mapRealtimeToEnv(realtime: RealtimeInterface): {
  enabled: 'yes' | 'no';
  protocol: 'websocket' | 'grpc';
} {
  if (realtime === 'none') {
    return { enabled: 'no', protocol: 'websocket' };
  }
  return {
    enabled: 'yes',
    protocol: realtime === 'grpc' ? 'grpc' : 'websocket'
  };
}

export type EnvRenderInput = {
  http: HttpInterface;
  realtime: RealtimeInterface;
  db: DbChoice;
  databaseName?: string;
};

/**
 * Render a `.env.dev` body from plan interfaces/db, starting from the seed
 * template content when provided.
 */
export function renderEnvDev(
  input: EnvRenderInput,
  templateContent = ''
): string {
  const driver = mapDbChoiceToDriver(input.db);
  const realtime = mapRealtimeToEnv(input.realtime);
  const databaseName = input.databaseName || 'jumentix';

  const replacements: Array<[RegExp, string]> = [
    [/^JUMENTIX_HTTP_FRAMEWORK=.*$/m, `JUMENTIX_HTTP_FRAMEWORK=${input.http}`],
    [/^JUMENTIX_REALTIME_API=.*$/m, `JUMENTIX_REALTIME_API=${realtime.enabled}`],
    [
      /^JUMENTIX_REALTIME_API_PROTOCOL=.*$/m,
      `JUMENTIX_REALTIME_API_PROTOCOL=${realtime.protocol}`
    ],
    [/^JUMENTIX_DATABASE_DRIVER=.*$/m, `JUMENTIX_DATABASE_DRIVER=${driver}`],
    [/^JUMENTIX_DATABASE_NAME=.*$/m, `JUMENTIX_DATABASE_NAME=${databaseName}`]
  ];

  let body = templateContent.trimEnd();
  if (!body) {
    body = [
      'JUMENTIX_HTTP_FRAMEWORK=express',
      'JUMENTIX_REALTIME_API=no',
      'JUMENTIX_REALTIME_API_PROTOCOL=websocket',
      'JUMENTIX_DATABASE_DRIVER=InMemory',
      'JUMENTIX_DATABASE_NAME=jumentix',
      ''
    ].join('\n');
  }

  for (const [pattern, line] of replacements) {
    if (pattern.test(body)) {
      body = body.replace(pattern, line);
    } else {
      body = `${body}\n${line}`;
    }
  }

  return `${body.trimEnd()}\n`;
}
