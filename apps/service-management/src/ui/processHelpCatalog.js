/**
 * Human-readable help text for known PM2 process roles in Jumentix ecosystems.
 * Match by exact name, then by role suffix after jumentix-(dev|staging|production)-.
 */

export const ROLE_HELP = {
  restapi: 'HTTP RestAPI process — OpenAPI REST surface (CRUD, auth, infra routes including /async-context-metrics).',
  websocketapi: 'WebSocket realtime API process — Socket.IO / realtime protocol on JUMENTIX_WEBSOCKET_PORT.',
  grpcapi: 'gRPC realtime API process — gRPC listeners on JUMENTIX_GRPC_PORT.',
  'service-management-api': 'Service Management catalog API — shared domain-catalog HTTP service for designer sync.',
  'service-management': 'Service Management console (designer + monitoring UI) — static SPA and local ops APIs on JUMENTIX_SERVICE_MANAGEMENT_PORT.',
  'purge-tombstones': 'Opt-in tombstone purge worker (JUM-822). dev default is dry-run via loopback; never the REST DELETE path.'
};

export const EXACT_HELP = {
  'jumentix-dev-restapi': ROLE_HELP.restapi,
  'jumentix-staging-restapi': ROLE_HELP.restapi,
  'jumentix-production-restapi': ROLE_HELP.restapi,
  'jumentix-dev-websocketapi': ROLE_HELP.websocketapi,
  'jumentix-staging-websocketapi': ROLE_HELP.websocketapi,
  'jumentix-production-websocketapi': ROLE_HELP.websocketapi,
  'jumentix-dev-grpcapi': ROLE_HELP.grpcapi,
  'jumentix-staging-grpcapi': ROLE_HELP.grpcapi,
  'jumentix-production-grpcapi': ROLE_HELP.grpcapi,
  'jumentix-dev-service-management-api': ROLE_HELP['service-management-api'],
  'jumentix-staging-service-management-api': ROLE_HELP['service-management-api'],
  'jumentix-production-service-management-api': ROLE_HELP['service-management-api'],
  'jumentix-dev-service-management': ROLE_HELP['service-management'],
  'jumentix-dev-purge-tombstones': ROLE_HELP['purge-tombstones'],
  'jumentix-staging-service-management': ROLE_HELP['service-management'],
  'jumentix-production-service-management': ROLE_HELP['service-management']
};

function roleSuffix(name) {
  const match = /^jumentix-(?:dev|staging|production)-(.+)$/.exec(String(name || ''));
  return match ? match[1] : '';
}

export function describeProcessHelp(processEntry = {}) {
  const name = String(processEntry.name || '').trim();
  if (name && EXACT_HELP[name]) {
    return { summary: EXACT_HELP[name], source: 'catalog' };
  }
  const role = roleSuffix(name);
  if (role && ROLE_HELP[role]) {
    return { summary: ROLE_HELP[role], source: 'catalog-role' };
  }
  const script = String(processEntry.script || '').trim() || '(unknown script)';
  const interpreter = String(processEntry.interpreter || '').trim() || 'default interpreter';
  return {
    summary: `Runs ${script} via ${interpreter}.`,
    source: 'fallback'
  };
}
