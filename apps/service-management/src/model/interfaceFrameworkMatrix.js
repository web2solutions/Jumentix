/**
 * interfaceFrameworkMatrix — the Communication Interface Designer tab's
 * framework vocabulary (JUM-545): which frameworks each interface type may
 * bind, from one machine-readable source.
 *
 * Sources of truth (mirrored, never transcribed from memory):
 *  - HTTP/REST and SSE — the eleven canonical `JUMENTIX_HTTP_FRAMEWORK` values
 *    of `apps/backend-template/src/interface/runtime/RuntimeEnvironment.ts`
 *    (adapter directories under `src/interface/HTTP/adapters/`). The JUM-461
 *    alias decision holds here: `derby-js` and `sails-js` are the ONLY
 *    canonical spellings; the bare `derby`/`sails` aliases and the dropped
 *    `hyper-express` are not offered. SSE streams are served by the HTTP
 *    adapter, so `sse` draws from the same set.
 *  - WebSocket — `socket-io`, the only adapter under
 *    `src/interface/WebSocket/adapters/`.
 *  - gRPC — `grpc`, the only adapter under `src/interface/gRPC/adapters/`.
 *
 * Pure data + pure lookups, DOM-free (same contract as
 * `deployCapabilityMatrix.js`): unknown keys resolve to empty lists/false and
 * the error report is deferred to the vocabulary rule in
 * `src/validation/interfaceAdapterValidation.js`.
 */

export const INTERFACE_TYPES = ['http-rest', 'grpc', 'websocket', 'sse'];

export const HTTP_FRAMEWORKS = [
  'express',
  'fastify',
  'restify',
  'cloudflare-workers',
  'vercel-functions',
  'loopback',
  'sails-js',
  'feathers',
  'derby-js',
  'adonis-js',
  'total-js'
];

export const GRPC_FRAMEWORKS = ['grpc'];

export const WEBSOCKET_FRAMEWORKS = ['socket-io'];

export const INTERFACE_TYPE_FRAMEWORKS = {
  'http-rest': HTTP_FRAMEWORKS,
  grpc: GRPC_FRAMEWORKS,
  websocket: WEBSOCKET_FRAMEWORKS,
  sse: HTTP_FRAMEWORKS
};

/**
 * @param {string} interfaceType
 * @returns {string[]} frameworks valid for the type; [] for an unknown type.
 */
export function getSupportedFrameworks(interfaceType) {
  return INTERFACE_TYPE_FRAMEWORKS[interfaceType] || [];
}

/**
 * @param {string} interfaceType
 * @param {string} framework
 * @returns {boolean}
 */
export function isFrameworkSupportedByType(interfaceType, framework) {
  return getSupportedFrameworks(interfaceType).includes(framework);
}
