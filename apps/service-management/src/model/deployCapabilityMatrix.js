/**
 * deployCapabilityMatrix — the machine-readable reader of the Requirement 059
 * matrices (`documentation/md/JUMENTIX-DEPLOY-TARGET-AND-PACKAGING-MATRIX.md`
 * and `documentation/md/JUMENTIX-SERVICE-FACTORY-CAPABILITIES-MATRIX.md`).
 *
 * JUM-544 extracts this reader as its own step because JUM-481 (deploy
 * management) had not landed yet: the Linear issue forbids transcribing the
 * matrix twice, so this module is the single source both tabs consume —
 * Service Configuration validation (JUM-544, run-mode × cloud-provider) and
 * deploy-target management (JUM-481, the per-service metadata contract).
 * Any change to the matrix docs MUST be reflected here in the same PR, and
 * vice versa.
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
 * Deploy-target metadata vocabularies — the "Service Management Metadata
 * Contract" section of the Deploy Target Matrix (Requirement 059), consumed
 * by the Deploy Management tab (JUM-481). `serviceType` uses the matrix's own
 * spellings (`restapi`, `websocket+restapi`, `grpc+restapi`, `functions`),
 * which predate — and intentionally differ from — the Service Configuration
 * `serviceKind` vocabulary pinned by Requirement 126.
 */
export const SERVICE_TYPES = ['restapi', 'websocket+restapi', 'grpc+restapi', 'functions'];

/** `deployTarget` vocabulary — one value per Deploy Target Matrix row. */
export const DEPLOY_TARGETS = [
  'dedicated-server',
  'vm',
  'ec2',
  'lambda',
  'vercel-functions',
  'cloudflare-workers'
];

/** `runtimeProtocol` vocabulary — the protocols a deploy target can bind. */
export const RUNTIME_PROTOCOLS = ['http', 'websocket', 'grpc'];

/** `pm2Profile` vocabulary — PM2 ecosystem profiles for VM-based targets. */
export const PM2_PROFILES = ['dev', 'staging', 'production'];

/**
 * `databaseDriver` / `keyValueDriver` vocabularies. The matrix defines these
 * fields by reference — "selected `JUMENTIX_DATABASE_DRIVER`" — so these
 * lists mirror the runtime env contract enums (Requirement 126 Contract 1;
 * the `server.js` write-allowlist enums, which `script.js`'s
 * `RUNTIME_ENV_ENUM_OPTIONS` already mirrors). They live here, not in the
 * validation module, so the DOM-free validator and the UI selects share one
 * source; the JUM-481 unit suite asserts the parity.
 */
export const DATABASE_DRIVERS = [
  'InMemory',
  'IndexedDB',
  'Mongo',
  'PostgreSQL',
  'MySQL',
  'MSSQL',
  'Oracle',
  'SQLite',
  'DynamoDB',
  'Cassandra',
  'Firebase',
  'Aurora',
  'RDS'
];

export const KEY_VALUE_DRIVERS = ['inmemory', 'redis'];

/**
 * Service types each deploy target supports, transcribed once from the
 * Deploy Target Matrix (Requirement 059):
 *
 * - Dedicated Server (SSH) and VM Cloud Instance (EC2/GCE/Azure VM) rows list
 *   REST, WebSocket+REST and gRPC+REST services (PM2-managed).
 * - AWS Lambda, Vercel Functions and Cloudflare Workers rows list
 *   Function/event APIs only.
 *
 * A `functions` service on a PM2 target — or a REST/realtime service on a
 * function target — has no row in the matrix and is rejected.
 */
export const DEPLOY_TARGET_SERVICE_TYPES = {
  'dedicated-server': ['restapi', 'websocket+restapi', 'grpc+restapi'],
  vm: ['restapi', 'websocket+restapi', 'grpc+restapi'],
  ec2: ['restapi', 'websocket+restapi', 'grpc+restapi'],
  lambda: ['functions'],
  'vercel-functions': ['functions'],
  'cloudflare-workers': ['functions']
};

/**
 * Deploy targets whose Runtime Manager column is PM2 (the Dedicated Server
 * and VM Cloud Instance rows). Only these carry a `pm2Profile`; a function
 * target with a PM2 profile is a design the matrix cannot build.
 */
export const PM2_MANAGED_DEPLOY_TARGETS = ['dedicated-server', 'vm', 'ec2'];

/**
 * Protocols each service type actually exposes: REST serves HTTP,
 * WebSocket+REST adds the realtime WebSocket listener, gRPC+REST adds the
 * gRPC listener, and function APIs are HTTP entrypoints.
 */
export const SERVICE_TYPE_PROTOCOLS = {
  restapi: ['http'],
  'websocket+restapi': ['http', 'websocket'],
  'grpc+restapi': ['http', 'grpc'],
  functions: ['http']
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

/**
 * Service types the matrix lists for a deploy target. Unknown targets return
 * an empty list; the vocabulary rule reports them, not this lookup.
 *
 * @param {string} deployTarget
 * @returns {string[]}
 */
export function getSupportedServiceTypes(deployTarget) {
  return DEPLOY_TARGET_SERVICE_TYPES[deployTarget] || [];
}

/**
 * @param {string} serviceType
 * @param {string} deployTarget
 * @returns {boolean} true when the Requirement 059 matrix has a row for the
 * combination.
 */
export function isServiceTypeSupportedByDeployTarget(serviceType, deployTarget) {
  return getSupportedServiceTypes(deployTarget).includes(serviceType);
}

/**
 * @param {string} deployTarget
 * @returns {boolean} true when the matrix's Runtime Manager column for the
 * target is PM2 (only those targets carry a `pm2Profile`).
 */
export function isPm2ManagedDeployTarget(deployTarget) {
  return PM2_MANAGED_DEPLOY_TARGETS.includes(deployTarget);
}

/**
 * Protocols a service type exposes. Unknown types return an empty list; the
 * vocabulary rule reports them, not this lookup.
 *
 * @param {string} serviceType
 * @returns {string[]}
 */
export function getSupportedProtocols(serviceType) {
  return SERVICE_TYPE_PROTOCOLS[serviceType] || [];
}

/**
 * @param {string} serviceType
 * @param {string} runtimeProtocol
 * @returns {boolean} true when the service type exposes the protocol.
 */
export function isProtocolSupportedByServiceType(serviceType, runtimeProtocol) {
  return getSupportedProtocols(serviceType).includes(runtimeProtocol);
}
