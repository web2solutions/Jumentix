/* istanbul ignore file */
export type HTTPFramework =
  | 'express'
  | 'fastify'
  | 'restify'
  | 'cloudflare-workers'
  | 'vercel-functions'
  | 'loopback'
  | 'sails-js'
  | 'feathers'
  | 'derby-js'
  | 'adonis-js'
  | 'total-js';

export type RealtimeApiProtocol = 'websocket' | 'grpc';

const DEFAULT_HTTP_FRAMEWORK: HTTPFramework = 'express';
const DEFAULT_REALTIME_PROTOCOL: RealtimeApiProtocol = 'websocket';

function normalize(value: string | undefined): string {
  return String(value || '').trim().toLowerCase();
}

/** Prefer JUMENTIX_*; fall back to legacy AAA_* during env migration. */
export function readProductEnv(
  env: NodeJS.ProcessEnv,
  key: `JUMENTIX_${string}`
): string | undefined {
  const value = env[key];
  // Whitespace-only counts as unset so legacy AAA_* can still apply.
  if (value !== undefined && value.trim() !== '') return value;
  return env[key.replace(/^JUMENTIX_/, 'AAA_')];
}

export function resolveHTTPFramework(env: NodeJS.ProcessEnv = process.env): HTTPFramework {
  const raw = readProductEnv(env, 'JUMENTIX_HTTP_FRAMEWORK');
  const framework = normalize(raw) || DEFAULT_HTTP_FRAMEWORK;
  if (
    framework === 'express'
    || framework === 'fastify'
    || framework === 'restify'
    || framework === 'cloudflare-workers'
    || framework === 'vercel-functions'
    || framework === 'loopback'
    || framework === 'sails-js'
    || framework === 'feathers'
    || framework === 'derby-js'
    || framework === 'adonis-js'
    || framework === 'total-js'
  ) return framework;
  throw new Error(
    `Unsupported JUMENTIX_HTTP_FRAMEWORK "${raw}".`
  );
}

export function isRealtimeApiEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return normalize(readProductEnv(env, 'JUMENTIX_REALTIME_API') || 'no') === 'yes';
}

export function resolveRealtimeApiProtocol(
  env: NodeJS.ProcessEnv = process.env
): RealtimeApiProtocol {
  const raw = readProductEnv(env, 'JUMENTIX_REALTIME_API_PROTOCOL');
  const protocol = normalize(raw) || DEFAULT_REALTIME_PROTOCOL;
  if (protocol === 'websocket' || protocol === 'grpc') return protocol;
  throw new Error(
    `Unsupported JUMENTIX_REALTIME_API_PROTOCOL "${raw}". Supported: websocket, grpc.`
  );
}

export function shouldStartRealtimeApi(
  expectedProtocol: RealtimeApiProtocol,
  env: NodeJS.ProcessEnv = process.env
): boolean {
  if (!isRealtimeApiEnabled(env)) return false;
  return resolveRealtimeApiProtocol(env) === expectedProtocol;
}
