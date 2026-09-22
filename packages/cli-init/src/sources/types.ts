/**
 * Normalized generation input produced by every source loader (JUM-846).
 * Persisted into `.jumentix/project.json` by workspace assembly (JUM-849).
 */

export type GenerationMode = 'monolith' | 'services' | 'hybrid' | 'frontend';

export type ServiceKind = 'core' | 'domain';

export type HttpInterface = 'express' | 'fastify' | 'restify';

export type RealtimeInterface = 'none' | 'websocket' | 'grpc';

export type DbChoice = 'sqlite' | 'postgres' | 'mysql' | 'mongo' | 'inmemory';

export type EntityRelation = {
  name: string;
  entity: string;
  match?: string;
  display?: string;
  kind?: string;
  /** Owning property name when the relation is declared on a field. */
  field?: string;
};

export type EntityOperation = {
  operationId: string;
  method: string;
  path: string;
  summary?: string;
};

export type PlanEntity = {
  name: string;
  schema: Record<string, unknown>;
  primaryKey: string;
  relations: EntityRelation[];
  operations: EntityOperation[];
};

export type PlanDomain = {
  id: string;
  name?: string;
  entities: PlanEntity[];
};

export type PlanService = {
  id: string;
  kind: ServiceKind;
  url?: string;
  domains: string[];
  interfaces: {
    http: HttpInterface;
    realtime: RealtimeInterface;
  };
  db: DbChoice;
};

export type GenerationPlan = {
  mode: GenerationMode;
  services: PlanService[];
  domains: PlanDomain[];
  frontend?: {
    modules: string[];
    offline: boolean;
  };
  contracts: {
    oasPerService: Record<string, Record<string, unknown>>;
    asyncapi?: Record<string, unknown>;
  };
};

export type SourceResolveOptions = {
  from?: string;
  preset?: string;
  mode?: string;
  http?: string;
  realtime?: string;
  db?: string;
  frontend?: boolean;
  offline?: boolean;
  /** Override fetch for catalog URLs (tests). */
  fetchImpl?: typeof fetch;
  /** Override Users preset OAS path (tests). */
  presetPath?: string;
};

export const ALLOWED_HTTP: readonly HttpInterface[] = ['express', 'fastify', 'restify'];
export const ALLOWED_REALTIME: readonly RealtimeInterface[] = ['none', 'websocket', 'grpc'];
export const ALLOWED_DB: readonly DbChoice[] = ['sqlite', 'postgres', 'mysql', 'mongo', 'inmemory'];
export const ALLOWED_MODES: readonly GenerationMode[] = ['monolith', 'services', 'hybrid', 'frontend'];

export class SourceResolutionError extends Error {
  readonly exitCode = 1;

  constructor(message: string) {
    super(message);
    this.name = 'SourceResolutionError';
  }
}
