/* eslint-disable no-console */
/**
 * generate-backend-template-seed — build Service Management first-run model
 * from the canonical OpenAPI that backend-template implements (`spec/1.0.0.yml`).
 *
 * Run on every `service-management:vendor` / app start so Domain Designer and
 * Architecture open against live contract definitions, not the toy Tasks sample.
 *
 * Outputs:
 *   - apps/service-management/generated/backend-template-seed.json
 *   - apps/service-management/generated/backend-template-seed.meta.json
 *   - apps/service-management/src/model/backendTemplateSeed.js  (browser-safe embed)
 */

const fs = require('fs');
const path = require('path');
const YAML = require('yaml');
const { isEntryPoint } = require('../../../ci-cd/lib/entry-point.js');

/** Module folders that are hexagonal infrastructure, not bounded contexts. */
const INFRA_MODULE_FOLDERS = new Set(['ddd', 'port']);

const SPEC_REL = path.join('spec', '1.0.0.yml');
const MODULES_REL = path.join('apps', 'backend-template', 'src', 'modules');
const OUT_DIR_REL = path.join('apps', 'service-management', 'generated');
const OUT_JSON_REL = path.join(OUT_DIR_REL, 'backend-template-seed.json');
const OUT_META_REL = path.join(OUT_DIR_REL, 'backend-template-seed.meta.json');
const OUT_EMBED_REL = path.join('apps', 'service-management', 'src', 'model', 'backendTemplateSeed.js');

function listDomainModules(modulesDir, readDir) {
  if (!fs.existsSync(modulesDir)) return [];
  return readDir(modulesDir)
    .filter((entry) => entry.isDirectory() && !INFRA_MODULE_FOLDERS.has(entry.name))
    .map((entry) => entry.name)
    .sort();
}

/**
 * Schemas the OAS importer would skip as port/DTO objects. Mirrored from
 * designerImporters.isPortObjectSchema so we never stamp `x-domain` onto a
 * port (stamping would force the importer to treat it as an entity).
 */
function isPortLikeSchema(schemaKey, schemaValue) {
  if (!schemaValue || typeof schemaValue !== 'object') return true;
  if (schemaValue['x-port-object'] === true) return true;
  if (schemaValue['x-entity'] || schemaValue['x-domain']) return false;
  if (schemaKey === 'ResourceDeleteResponse' || schemaKey === 'EntityMetricsResponse') return true;
  if (/^Request[A-Z]/.test(schemaKey) || /ArrayOf$/.test(schemaKey)) return true;
  const description = String(schemaValue.description || '');
  if (/^Port (input|output) object/.test(description)
    && !/^Port output object for .+ resource\./.test(description)) {
    return true;
  }
  const type = schemaValue.type;
  if (type && type !== 'object') return true;
  if (!schemaValue.properties || typeof schemaValue.properties !== 'object') return true;
  return false;
}

/**
 * Canonical OAS today omits `x-domain` / `x-service` on entity schemas. Stamp
 * them from backend-template module folders before `buildDomainsFromOas` so
 * the seed carries a named Users domain (and Architecture can assign it to
 * Core) instead of a single "Imported" bucket.
 */
function stampSchemaDomainsFromModules(parsed, moduleNames) {
  const schemas = parsed?.components?.schemas;
  if (!schemas || typeof schemas !== 'object') return { stamped: 0 };
  const defaultDomain = moduleNames.includes('Users')
    ? 'Users'
    : (moduleNames[0] || 'Imported');
  const defaultService = Array.isArray(parsed?.['x-services']) && parsed['x-services'][0]?.id
    ? String(parsed['x-services'][0].id)
    : 'core';
  let stamped = 0;
  Object.entries(schemas).forEach(([schemaKey, schemaValue]) => {
    if (isPortLikeSchema(schemaKey, schemaValue)) return;
    if (!String(schemaValue['x-domain'] || '').trim()) {
      schemaValue['x-domain'] = defaultDomain;
      stamped += 1;
    }
    if (!String(schemaValue['x-service'] || '').trim()) {
      schemaValue['x-service'] = defaultService;
    }
    if (!String(schemaValue['x-entity'] || '').trim()) {
      schemaValue['x-entity'] = schemaKey;
    }
  });
  return { stamped, defaultDomain, defaultService };
}

function collectOasDomainNames(parsed) {
  const names = new Set();
  const schemas = parsed?.components?.schemas;
  if (!schemas || typeof schemas !== 'object') return names;
  Object.values(schemas).forEach((schema) => {
    const domain = String(schema?.['x-domain'] || '').trim();
    if (domain) names.add(domain);
  });
  return names;
}

function assertModuleDomainsInOas(moduleNames, oasDomains, logger) {
  const missing = moduleNames.filter((name) => !oasDomains.has(name));
  if (missing.length) {
    logger.error(
      `[ci] backend-template seed: module domain(s) missing from OAS x-domain: ${missing.join(', ')}`
    );
    return false;
  }
  return true;
}

function stableStringify(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function slugId(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'item';
}

/**
 * `buildDomainsFromOas` uses random `fallbackId` suffixes. Seed payloads must
 * be byte-stable across regenerations of the same OAS so Cana migrations and
 * tests can assert identity.
 */
function stabilizeSeedIds(payload) {
  const domains = Array.isArray(payload.domains) ? payload.domains : [];
  const idMap = new Map();
  domains.forEach((domain, domainIndex) => {
    const nextDomainId = `backend-domain-${slugId(domain.name) || domainIndex}`;
    idMap.set(domain.id, nextDomainId);
    domain.id = nextDomainId;
    (domain.entities || []).forEach((entity, entityIndex) => {
      const nextEntityId = `backend-entity-${slugId(domain.name)}-${slugId(entity.name) || entityIndex}`;
      idMap.set(entity.id, nextEntityId);
      entity.id = nextEntityId;
    });
  });
  (payload.relationships || []).forEach((relationship, index) => {
    relationship.id = `backend-rel-${slugId(relationship.name) || index}`;
    if (idMap.has(relationship.fromEntityId)) {
      relationship.fromEntityId = idMap.get(relationship.fromEntityId);
    }
    if (idMap.has(relationship.toEntityId)) {
      relationship.toEntityId = idMap.get(relationship.toEntityId);
    }
  });
  const architecture = payload.architecture;
  if (architecture && Array.isArray(architecture.services)) {
    architecture.services.forEach((service) => {
      service.domains = (service.domains || []).map((domainId) => idMap.get(domainId) || domainId);
    });
  }
  return payload;
}

function buildEmbedModule(seedPayload, meta) {
  return `/**
 * backendTemplateSeed — generated. Do not edit by hand.
 *
 * Regenerated by apps/service-management/scripts/generate-backend-template-seed.js
 * from ${meta.source} at ${meta.generatedAt}.
 *
 * Browser-safe ESM embed so SM seed()/Load backend model work offline (PWA).
 */

/** @returns {{ domains: Array, relationships: Array, architecture?: Object }} */
export function buildBackendTemplateSeedPayload() {
  return ${JSON.stringify(seedPayload, null, 2)};
}

export const BACKEND_TEMPLATE_SEED_META = ${JSON.stringify(meta, null, 2)};
`;
}

/**
 * @param {Object} [options]
 * @returns {number} process exit code
 */
function generateBackendTemplateSeed(options = {}) {
  const root = options.root || process.cwd();
  const exists = options.exists || fs.existsSync;
  const readFile = options.readFile || ((p) => fs.readFileSync(p, 'utf8'));
  const writeFile = options.writeFile || ((target, contents) => {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, contents);
  });
  const readDir = options.readDir || ((dir) => fs.readdirSync(dir, { withFileTypes: true }));
  const logger = options.logger || console;
  const parseYaml = options.parseYaml || ((raw) => YAML.parse(raw));
  // Lazy-require designer-core so unit tests can inject mappers.
  const buildDomainsFromOas = options.buildDomainsFromOas
    || require('../../../packages/designer-core/src/importers/designerImporters.js').buildDomainsFromOas;
  const applyAutoLayout = options.applyAutoLayout
    || require('../../../packages/designer-core/src/model/modelQueries.js').applyAutoLayout;

  const specPath = path.join(root, SPEC_REL);
  if (!exists(specPath)) {
    logger.error(`[ci] backend-template seed: OAS not found: ${specPath}`);
    return 1;
  }

  let parsed;
  try {
    parsed = parseYaml(readFile(specPath));
  } catch (error) {
    logger.error(`[ci] backend-template seed: failed to parse OAS: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }

  const moduleNames = listDomainModules(path.join(root, MODULES_REL), readDir);
  stampSchemaDomainsFromModules(parsed, moduleNames);
  const oasDomains = collectOasDomainNames(parsed);
  if (!assertModuleDomainsInOas(moduleNames, oasDomains, logger)) {
    return 1;
  }

  const mapped = buildDomainsFromOas(parsed);
  if (!mapped?.ok) {
    logger.error(`[ci] backend-template seed: buildDomainsFromOas failed (${mapped?.reason || 'unknown'})`);
    return 1;
  }

  const seedPayload = stabilizeSeedIds({
    domains: mapped.domains,
    relationships: mapped.relationships,
    architecture: mapped.architecture
  });
  // OAS import packs entities on a fixed 120px row step — tall cards (User,
  // Organization) overlap. Height-aware auto-layout leaves corridors for edges.
  applyAutoLayout(seedPayload.domains);

  const schemaCount = Object.keys(parsed?.components?.schemas || {}).length;
  const meta = {
    generatedAt: options.now || new Date().toISOString(),
    source: SPEC_REL.split(path.sep).join('/'),
    schemaCount,
    domainCount: seedPayload.domains.length,
    relationshipCount: seedPayload.relationships.length,
    backendModules: moduleNames
  };

  writeFile(path.join(root, OUT_JSON_REL), stableStringify(seedPayload));
  writeFile(path.join(root, OUT_META_REL), stableStringify(meta));
  writeFile(path.join(root, OUT_EMBED_REL), buildEmbedModule(seedPayload, meta));

  logger.log(
    `[ci] backend-template seed: wrote ${OUT_JSON_REL} `
    + `(${meta.domainCount} domains, ${meta.relationshipCount} relationships, ${schemaCount} schemas)`
  );
  return 0;
}

module.exports = {
  INFRA_MODULE_FOLDERS,
  SPEC_REL,
  OUT_JSON_REL,
  OUT_META_REL,
  OUT_EMBED_REL,
  generateBackendTemplateSeed,
  listDomainModules,
  collectOasDomainNames,
  assertModuleDomainsInOas,
  stampSchemaDomainsFromModules,
  isPortLikeSchema,
  stabilizeSeedIds,
  buildEmbedModule
};

if (isEntryPoint(module)) {
  process.exitCode = generateBackendTemplateSeed();
}
