/**
 * deployCapabilityMatrix — the machine-readable reader of the Requirement 059
 * matrices (`documentation/md/JUMENTIX-DEPLOY-TARGET-AND-PACKAGING-MATRIX.md`
 * and `documentation/md/JUMENTIX-SERVICE-FACTORY-CAPABILITIES-MATRIX.md`).
 *
 * JUM-544 extracts this reader as its own step because JUM-481 (deploy
 * management) has not landed yet: the Linear issue forbids transcribing the
 * matrix twice, so this module is the single source both tabs consume —
 * Service Configuration validation (JUM-544) now, deploy-target management
 * (JUM-481) when it lands. Any change to the matrix docs MUST be reflected
 * here in the same PR, and vice versa.
 *
 * Pure data + pure lookups: no `document`, no `window` — the module imports
 * and runs under Bun/Node with no DOM shim (the JUM-470 suite precondition).
 */

/** `serviceKind` vocabulary — pinned by Requirement 126 (storage schema). */
export const SERVICE_KINDS = ['rest-api', 'websocket-rest-api', 'grpc-rest-api'];

/** `runMode` vocabulary — pinned by Requirement 126 (storage schema). */
export const RUN_MODES = ['dedicated-server', 'virtual-machine', 'container', 'functions'];

/**
 * `cloudProvider` vocabulary. Requirement 126 lists
 * `aws/google/azure/vercel/cloudflare/docker`; the UI also offers
 * `self-hosted` (the Dedicated Server (SSH) row of the deploy matrix), so the
 * reader accepts it — the storage schema section of Req 126 is updated to
 * match when the schema next changes.
 */
export const CLOUD_PROVIDERS = [
  'aws',
  'google',
  'azure',
  'vercel',
  'cloudflare',
  'docker',
  'self-hosted'
];

/**
 * Ports each service kind actually binds. The deploy matrix packages
 * REST-only, WebSocket+REST and gRPC+REST services; a `rest-api` service has
 * no realtime listener, so its unused ports are not validated for uniqueness
 * (JUM-544 acceptance criterion).
 */
export const SERVICE_KIND_ACTIVE_PORTS = {
  'rest-api': ['rest'],
  'websocket-rest-api': ['rest', 'websocket'],
  'grpc-rest-api': ['rest', 'grpc']
};

/**
 * Run-mode × cloud-provider support, transcribed once from the Deploy Target
 * Matrix (Requirement 059):
 *
 * - Dedicated Server (SSH): a PM2-managed machine under the operator's
 *   control → `self-hosted`.
 * - VM Cloud Instance (EC2/GCE/Azure VM): PM2-managed cloud VMs →
 *   `aws`, `google`, `azure`.
 * - Container: the packaging contract is runtime-manager-agnostic →
 *   `docker`, or the operator's own host (`self-hosted`).
 * - Functions: provider-native function targets only — AWS Lambda → `aws`,
 *   Vercel Functions → `vercel`, Cloudflare Workers → `cloudflare`.
 *
 * Anything outside these rows (e.g. `functions` + `self-hosted`, or a
 * PM2-based run mode against `vercel`/`cloudflare`) has no deploy target in
 * the matrix and is rejected.
 */
export const RUN_MODE_PROVIDER_SUPPORT = {
  'dedicated-server': ['self-hosted'],
  'virtual-machine': ['aws', 'google', 'azure'],
  container: ['docker', 'self-hosted'],
  functions: ['aws', 'vercel', 'cloudflare']
};

/**
 * Active port names for a service kind. Unknown kinds return the REST-only
 * set so port validation still runs while the vocabulary rule reports the
 * unknown kind.
 *
 * @param {string} serviceKind
 * @returns {Array<'rest'|'websocket'|'grpc'>}
 */
export function getActivePortNames(serviceKind) {
  return SERVICE_KIND_ACTIVE_PORTS[serviceKind] || SERVICE_KIND_ACTIVE_PORTS['rest-api'];
}

/**
 * Providers the matrix lists for a run mode. Unknown run modes return an
 * empty list; the vocabulary rule reports them, not this lookup.
 *
 * @param {string} runMode
 * @returns {string[]}
 */
export function getSupportedProviders(runMode) {
  return RUN_MODE_PROVIDER_SUPPORT[runMode] || [];
}

/**
 * @param {string} runMode
 * @param {string} cloudProvider
 * @returns {boolean} true when the Requirement 059 matrix has a deploy
 * target for the combination.
 */
export function isRunModeSupportedByProvider(runMode, cloudProvider) {
  return getSupportedProviders(runMode).includes(cloudProvider);
}
