import type { DbChoice, HttpInterface, RealtimeInterface } from '../sources/types';
import type { JumentixPin } from './jumentixVersions';
import { sanitizePackageScope, sanitizeServiceId } from './paths';

export const JUMENTIX_RUNTIME_DEPS = Object.freeze([
  '@jumentix/adapter-runtime-bootstrap',
  '@jumentix/database-client-factory',
  '@jumentix/dead-letter-queue',
  '@jumentix/external-db-repositories',
  '@jumentix/external-persistence-core',
  '@jumentix/external-store-proxy',
  '@jumentix/key-value-storage',
  '@jumentix/message-mediator',
  '@jumentix/mutex-service',
  '@jumentix/persistence-contracts',
  '@jumentix/shared-contracts'
]);

export type PackageJsonInput = {
  projectName: string;
  serviceId: string;
  /** Version resolver for each `@jumentix/*` dependency. */
  pin: JumentixPin;
  http: HttpInterface;
  realtime: RealtimeInterface;
  db: DbChoice;
};

/**
 * Build a standalone `package.json` for a generated backend service.
 */
export function buildServicePackageJson(input: PackageJsonInput): Record<string, unknown> {
  const scope = sanitizePackageScope(input.projectName);
  const service = sanitizeServiceId(input.serviceId);

  const dependencies: Record<string, string> = {};
  for (const name of JUMENTIX_RUNTIME_DEPS) {
    dependencies[name] = input.pin(name);
  }

  return {
    name: `@${scope}/${service}`,
    version: '0.0.0',
    private: true,
    description: `Generated Jumentix backend service (${service})`,
    type: 'commonjs',
    scripts: {
      dev: 'NODE_ENV=dev bun src/interface/HTTP/adapters/start-rest-api.ts',
      test: 'NODE_ENV=dev bun test',
      build: 'NODE_ENV=dev tsc -p tsconfig.json',
      lint: 'eslint src --ext .ts',
      typecheck: 'NODE_ENV=dev tsc -p tsconfig.json --noEmit'
    },
    dependencies,
    jumentix: {
      generated: true,
      serviceId: service,
      http: input.http,
      realtime: input.realtime,
      db: input.db
    }
  };
}
