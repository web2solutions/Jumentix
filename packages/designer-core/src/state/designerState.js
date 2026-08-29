/**
 * designerState — the DOM-free state and persistence core of the Service
 * Management designer, extracted from `script.js` by JUM-468.
 *
 * Everything in this module is pure JavaScript: no `document`, no `window`,
 * no `localStorage`. Persistence crosses the `IDesignerStore` port (injected),
 * and the two impure collaborators — the seed template and the render pass —
 * are injected callbacks, so the module imports and runs under Bun/Node with
 * no DOM shim. That is the precondition for the JUM-470/JUM-471 unit suites.
 *
 * Behaviour is byte-identical to the pre-extraction `script.js`: same default
 * state, same normalisation on load, same history semantics, same payload
 * sections written through the store — with two deliberate exceptions:
 * `meta.rbac` rules are normalised against the tenant RBAC contract
 * (`src/model/rbacContract.js`), which re-derives `tenantScoped` from the
 * rule's roles because the runtime has no independent tenant-scope knob
 * (JUM-477); and the `deployments` section is restored on load, migrated
 * forward to the Requirement 059 metadata contract by
 * `normalizeDeploymentInput` (JUM-481). JUM-547 extended
 * `normalizeStatePayload` to also normalise the `interfaces`,
 * `serviceConfiguration` and `runtimeEnvironment` sections, so the full-suite
 * export/import crossing applies the same normalisation discipline as the
 * load path (load itself still restores the model slice only).
 */

import {
  RBAC_ACTIONS,
  deriveTenantScoped,
  normalizeRbacRule
} from '../model/rbacContract.js';
import {
  getSupportedProtocols,
  getSupportedServiceTypes,
  isPm2ManagedDeployTarget
} from '../model/deployCapabilityMatrix.js';

export const DOMAIN_COLORS = ['#60a5fa', '#34d399', '#f59e0b', '#f472b6', '#22d3ee', '#a78bfa', '#fb7185', '#84cc16'];
/*
 * Domain box geometry (JUM-729 follow-up).
 *
 * The domain was a fixed 520x280 box in CSS, and the canvas clamped entities
 * against those two numbers written out by hand in two different files. A
 * domain that outgrew its box could not be made bigger, so entities piled up
 * against an invisible wall and the diagram stopped matching the model.
 *
 * The size now lives in the state, defaulted to what the CSS drew, so an older
 * saved model opens exactly as it did. The minimums are the smallest box that
 * still shows a header and one entity.
 */
export const DOMAIN_DEFAULT_WIDTH = 520;
export const DOMAIN_DEFAULT_HEIGHT = 280;
export const DOMAIN_MIN_WIDTH = 240;
export const DOMAIN_MIN_HEIGHT = 160;
/** Header strip above `.domain-body`, where entities are positioned. */
export const DOMAIN_HEADER_HEIGHT = 50;
// Widened for the editable field rows (JUM-729 follow-up): a name, a type select and
// three toggles do not fit the 190px the read-only text line needed. Kept in
// step with `.entity { width }` in styles.css.
export const ENTITY_WIDTH = 260;

export const FIELD_TYPES = ['string', 'integer', 'number', 'boolean', 'array', 'object', 'date', 'datetime', 'uuid'];

/**
 * Identity and schema version of the full-suite JSON export document
 * (JUM-547, Requirement 126 Contract 3). Pre-JUM-547 documents carry no
 * `kind`/`version` and are treated as the legacy domain-only shape on import.
 * `SUITE_EXPORT_MAJOR` is the highest document major version the importer
 * accepts; a newer major fails clearly instead of half-importing.
 */
export const SUITE_EXPORT_KIND = 'service-management-suite';
export const SUITE_EXPORT_VERSION = '2.0.0';
export const SUITE_EXPORT_MAJOR = 2;

/** History depth cap, unchanged from the pre-extraction `recordHistory`. */
const HISTORY_LIMIT = 100;

export function parseEnumValues(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((item) => String(item).trim()).filter(Boolean);
  return String(raw)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function parseCommaSeparated(raw) {
  if (Array.isArray(raw)) return raw.map((item) => String(item).trim()).filter(Boolean);
  return String(raw || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function normalizeOptionalNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export function clampZoom(value) {
  return Math.max(0.5, Math.min(2, value));
}

export function fallbackId(prefix, seed) {
  return `${prefix}-import-${seed}-${Math.random().toString(36).slice(2, 8)}`;
}

export function normalizeField(field, fieldIndex) {
  const name = String(field?.name || '').trim() || `field_${fieldIndex + 1}`;
  const type = FIELD_TYPES.includes(field?.type) ? field.type : 'string';
  const enumValues = parseEnumValues(field?.enumValues ?? field?.enum);
  const format = String(field?.format || '').trim();
  const description = String(field?.description || '').trim();
  const pattern = String(field?.pattern || '').trim();
  const itemsTypeRaw = String(field?.itemsType || '').trim();
  const itemsType = FIELD_TYPES.includes(itemsTypeRaw) ? itemsTypeRaw : '';
  const minLength = normalizeOptionalNumber(field?.minLength);
  const maxLength = normalizeOptionalNumber(field?.maxLength);
  const minimum = normalizeOptionalNumber(field?.minimum);
  const maximum = normalizeOptionalNumber(field?.maximum);
  return {
    name,
    type,
    required: Boolean(field?.required),
    pk: Boolean(field?.pk),
    fk: Boolean(field?.fk),
    unique: Boolean(field?.unique),
    nullable: Boolean(field?.nullable),
    format,
    description,
    enumValues,
    pattern,
    minLength,
    maxLength,
    minimum,
    maximum,
    itemsType: type === 'array' ? (itemsType || 'string') : ''
  };
}

export function normalizeContractInput(contract, contractIndex = 0) {
  const id = String(contract?.id || '').trim() || fallbackId('contract', contractIndex);
  return {
    id,
    name: String(contract?.name || '').trim() || `Contract_${contractIndex + 1}`,
    type: ['event', 'command', 'request', 'response'].includes(contract?.type) ? contract.type : 'event',
    channel: String(contract?.channel || '').trim(),
    version: String(contract?.version || '').trim() || '1.0.0',
    payloadSchema: contract?.payloadSchema && typeof contract.payloadSchema === 'object'
      ? contract.payloadSchema
      : {}
  };
}

/**
 * A canvas note (JUM-729 follow-up).
 *
 * The model records what the system *is*; a note records what the people
 * modelling it need to remember while they work — an open question, a decision
 * and its reason, a "this mirrors the billing contract". That belongs on the
 * diagram, next to the thing it is about, and it deliberately does not enter
 * the OAS export or the code generator: it is not part of the contract.
 */
export function normalizeNote(note, noteIndex) {
  return {
    id: note?.id || fallbackId('note', noteIndex),
    text: String(note?.text || '').trim(),
    x: Number.isFinite(note?.x) ? note.x : 60 + noteIndex * 24,
    y: Number.isFinite(note?.y) ? note.y : 60 + noteIndex * 24,
    color: /^#[0-9a-f]{6}$/i.test(note?.color || '') ? note.color : '#fde68a'
  };
}

export function normalizeRelationship(relationship) {
  return {
    ...relationship,
    name: relationship.name || `${relationship.fromEntityId} -> ${relationship.toEntityId}`,
    fromCardinality: relationship.fromCardinality || 'N',
    toCardinality: relationship.toCardinality || '1',
    fromAnchorSide: ['top', 'right', 'bottom', 'left'].includes(relationship.fromAnchorSide) ? relationship.fromAnchorSide : null,
    toAnchorSide: ['top', 'right', 'bottom', 'left'].includes(relationship.toAnchorSide) ? relationship.toAnchorSide : null,
    // JUM-729 follow-up: the columns the link joins. Additive — a relationship saved
    // before field anchors existed normalises to null on both ends and is
    // drawn from the entity side exactly as it was.
    fromField: String(relationship.fromField || '').trim() || null,
    toField: String(relationship.toField || '').trim() || null,
    anchorBehavior: relationship.anchorBehavior === 'center' ? 'center' : 'auto',
    bendX: normalizeOptionalNumber(relationship.bendX),
    bendY: normalizeOptionalNumber(relationship.bendY),
    labelOffsetX: normalizeOptionalNumber(relationship.labelOffsetX) ?? 0,
    labelOffsetY: normalizeOptionalNumber(relationship.labelOffsetY) ?? 0
  };
}

export function normalizeCodeWorkspaceFile(file) {
  const state = ['generated', 'edited', 'stale'].includes(file?.state) ? file.state : 'generated';
  const generatedContent = String(file?.generatedContent || '');
  const baseContent = String(file?.baseContent ?? generatedContent);
  const content = String(file?.content ?? generatedContent);
  return {
    path: String(file?.path || '').trim(),
    state,
    baseContent,
    generatedContent,
    content,
    updatedAt: String(file?.updatedAt || '')
  };
}

export function normalizeCodeWorkspaceInput(input) {
  const files = {};
  const source = input?.files && typeof input.files === 'object' ? input.files : {};
  Object.entries(source).forEach(([path, file]) => {
    const normalized = normalizeCodeWorkspaceFile({ path, ...(file || {}) });
    if (normalized.path) files[normalized.path] = normalized;
  });
  return {
    files,
    activePath: String(input?.activePath || '').trim()
  };
}

/**
 * Legacy deploy-target `type` values (the pre-JUM-481 UI select) that differ
 * from the Requirement 059 `deployTarget` vocabulary. Values already spelled
 * as the matrix spells them pass through untouched; values with no matrix
 * counterpart (`azure-functions`, `google-functions`) are kept verbatim so
 * the migration is lossless — the validation vocabulary rule flags them.
 */
const LEGACY_DEPLOY_TYPE_ALIASES = {
  dedicated: 'dedicated-server'
};

/**
 * Normalise one deploy target to the Requirement 059 metadata contract
 * (JUM-481): the pre-JUM-481 `{ name, type, region, runtime }` shape migrates
 * forward — `type` becomes `deployTarget` (through the alias map) and the
 * missing metadata fields take the matrix-derived defaults: the first
 * service type the target supports, that type's first protocol, the runtime
 * env contract's default drivers, and the `dev` PM2 profile on PM2-managed
 * targets only.
 */
export function normalizeDeploymentInput(deployment) {
  const source = deployment || {};
  const legacyType = String(source.type || '').trim();
  const deployTarget = String(source.deployTarget || '').trim()
    || LEGACY_DEPLOY_TYPE_ALIASES[legacyType]
    || legacyType;
  const serviceType = String(source.serviceType || '').trim()
    || getSupportedServiceTypes(deployTarget)[0]
    || '';
  const runtimeProtocol = String(source.runtimeProtocol || '').trim()
    || getSupportedProtocols(serviceType)[0]
    || '';
  return {
    name: String(source.name || '').trim(),
    region: String(source.region || '').trim(),
    runtime: String(source.runtime || '').trim(),
    serviceType,
    deployTarget,
    runtimeProtocol,
    databaseDriver: String(source.databaseDriver || '').trim() || 'InMemory',
    keyValueDriver: String(source.keyValueDriver || '').trim() || 'redis',
    pm2Profile: String(source.pm2Profile || '').trim()
      || (isPm2ManagedDeployTarget(deployTarget) ? 'dev' : '')
  };
}

/**
 * Normalise one interface adapter entry (Interface Designer tab) to the
 * `{ type, framework, entrypoint, controller }` shape the UI writes. Values
 * are trimmed strings; an empty `type` falls back to `http-rest`, and unknown
 * non-empty values are kept verbatim (the same lossless-migration precedent
 * as `normalizeDeploymentInput`) so a sibling tab lifecycle change never
 * makes the import path drop data.
 */
export function normalizeInterfaceInput(entry) {
  const source = entry || {};
  return {
    type: String(source.type || '').trim() || 'http-rest',
    framework: String(source.framework || '').trim(),
    entrypoint: String(source.entrypoint || '').trim(),
    controller: String(source.controller || '').trim()
  };
}

/**
 * Normalise the Service Configuration tab section to the Requirement 126
 * Contract 2 shape: `{ serviceKind, runMode, cloudProvider, staticAssetsPath,
 * ports: { rest, websocket, grpc } }`. Known enum values pass; unknown
 * non-empty values are kept verbatim (lossless — the JUM-544 validation
 * reports them); empty/missing values take the tab defaults. Ports are
 * finite numbers, defaulting to the canonical 3000/3001/3002.
 */
export function normalizeServiceConfigurationInput(configuration) {
  const source = configuration || {};
  const enumOrDefault = (value, fallback) => String(value || '').trim() || fallback;
  const portOrDefault = (value, fallback) => (Number.isFinite(Number(value)) && value !== null && value !== ''
    ? Number(value)
    : fallback);
  const ports = source.ports || {};
  return {
    serviceKind: enumOrDefault(source.serviceKind, 'rest-api'),
    runMode: enumOrDefault(source.runMode, 'dedicated-server'),
    cloudProvider: enumOrDefault(source.cloudProvider, 'aws'),
    staticAssetsPath: String(source.staticAssetsPath || '').trim(),
    ports: {
      rest: portOrDefault(ports.rest, 3000),
      websocket: portOrDefault(ports.websocket, 3001),
      grpc: portOrDefault(ports.grpc, 3002)
    }
  };
}

/**
 * Normalise the `runtimeEnvironment` section to the Requirement 126 Contract 2
 * shape `{ environment, fileName, values }`. Note the JUM-547 export decision
 * (recorded in Requirement 126 Contract 3): the full-suite export document
 * carries only the environment *selection* (`environment`, `fileName`) —
 * `values` mirror real `.env` contents of the machine the designer runs on
 * and never leave in a bundle. This normaliser still accepts a `values`
 * object (a raw `service-management.v1` payload dump carries one); the import
 * mapper decides whether the local machine's values are preserved.
 */
export function normalizeRuntimeEnvironmentInput(runtimeEnvironment) {
  const source = runtimeEnvironment || {};
  const values = source.values && typeof source.values === 'object' && !Array.isArray(source.values)
    ? { ...source.values }
    : {};
  return {
    environment: String(source.environment || '').trim() || 'dev',
    fileName: String(source.fileName || '').trim() || '.env.dev',
    values
  };
}

/**
 * The designer's default per-entity RBAC policy. The role sets mirror the
 * runtime's normalized-role semantics (`ROLE_SCOPE_MATRIX` in `Rbac.ts`):
 * `admin`/`superadmin` for collection and mutating actions, `user` added for
 * single-record reads. `tenantScoped` is not a free choice — it is derived
 * from the roles exactly as the runtime derives it (see `rbacContract.js`),
 * so an entity created without explicit RBAC behaves in the designer as it
 * will behave in the boilerplate (JUM-477).
 */
export function getDefaultRbacPolicy() {
  const defaultRoles = {
    list: ['superadmin', 'admin'],
    getById: ['superadmin', 'admin', 'user'],
    create: ['superadmin', 'admin'],
    update: ['superadmin', 'admin'],
    delete: ['superadmin', 'admin']
  };
  const policy = {};
  RBAC_ACTIONS.forEach((action) => {
    policy[action] = {
      roles: [...defaultRoles[action]],
      tenantScoped: deriveTenantScoped(defaultRoles[action])
    };
  });
  return policy;
}

/**
 * Normalize a stored `meta.rbac` policy against the tenant RBAC contract:
 * every action rule is rebuilt by `normalizeRbacRule` over the default
 * policy, so `tenantScoped` is re-derived from the roles (a stored flag the
 * runtime could not honour is repaired on load) and unknown roles are kept
 * for validation to reject rather than silently dropped (JUM-477).
 */
export function normalizeRbacPolicyInput(sourceRbac) {
  const rbac = getDefaultRbacPolicy();
  const source = sourceRbac || {};
  RBAC_ACTIONS.forEach((action) => {
    rbac[action] = normalizeRbacRule(source[action], rbac[action]);
  });
  return rbac;
}

export function defaultFields() {
  return [
    normalizeField({ name: 'id', type: 'uuid', required: true, pk: true, fk: false, unique: true }, 0),
    normalizeField({ name: 'createdAt', type: 'date', required: true, pk: false, fk: false, unique: false }, 1),
    normalizeField({ name: 'updatedAt', type: 'date', required: true, pk: false, fk: false, unique: false }, 2)
  ];
}

export function normalizeEntityInput(entity, entityIndex) {
  const fieldsInput = Array.isArray(entity?.fields) ? entity.fields : defaultFields();
  const fields = fieldsInput.map((field, fieldIndex) => normalizeField(field, fieldIndex));
  const entityName = String(entity?.name || '').trim() || `Entity_${entityIndex + 1}`;
  const invariants = Array.isArray(entity?.meta?.invariants)
    ? entity.meta.invariants.map((item) => String(item).trim()).filter(Boolean)
    : parseCommaSeparated(String(entity?.meta?.invariants || '').replace(/\n/g, ','));
  const rbac = normalizeRbacPolicyInput(entity?.meta?.rbac);
  const contracts = Array.isArray(entity?.meta?.contracts)
    ? entity.meta.contracts.map((contract, index) => normalizeContractInput(contract, index))
    : [];
  const oasComposition = {
    mode: ['oneOf', 'allOf', 'anyOf'].includes(entity?.meta?.oasComposition?.mode)
      ? entity.meta.oasComposition.mode
      : '',
    refs: parseCommaSeparated(entity?.meta?.oasComposition?.refs || []),
    externalRefs: parseCommaSeparated(entity?.meta?.oasComposition?.externalRefs || []),
    discriminator: String(entity?.meta?.oasComposition?.discriminator || '').trim()
  };
  return {
    id: entity?.id || fallbackId('entity', entityIndex),
    name: entityName,
    x: Number.isFinite(entity?.x) ? entity.x : 14 + (entityIndex % 2) * 206,
    y: Number.isFinite(entity?.y) ? entity.y : 14 + Math.floor(entityIndex / 2) * 120,
    fields,
    meta: {
      aggregateRoot: Boolean(entity?.meta?.aggregateRoot),
      invariants,
      rbac,
      contracts,
      oasComposition,
      // JUM-492: provenance is additive — carried only when present, so
      // pre-JUM-492 payloads normalise to exactly the shape they always did.
      ...(entity?.meta?.provenance && typeof entity.meta.provenance === 'object'
        ? {
          provenance: {
            package: String(entity.meta.provenance.package || '').trim(),
            version: String(entity.meta.provenance.version || '').trim()
          }
        }
        : {})
    }
  };
}

export function normalizeDomainInput(domain, domainIndex) {
  const entitiesInput = Array.isArray(domain?.entities) ? domain.entities : [];
  const entities = entitiesInput.map((entity, entityIndex) => normalizeEntityInput(entity, entityIndex));
  return {
    id: domain?.id || fallbackId('domain', domainIndex),
    name: String(domain?.name || '').trim() || `Domain_${domainIndex + 1}`,
    color: /^#[0-9a-f]{6}$/i.test(domain?.color || '') ? domain.color : DOMAIN_COLORS[domainIndex % DOMAIN_COLORS.length],
    x: Number.isFinite(domain?.x) ? domain.x : 120 + domainIndex * 40,
    y: Number.isFinite(domain?.y) ? domain.y : 90 + domainIndex * 30,
    // JUM-729 follow-up: absent in every model saved before the domain box could be
    // resized, so the default is the size the CSS used to draw.
    // JUM-729 follow-up: collapsed domains keep their position and their links; only
    // their contents are out of the way.
    collapsed: Boolean(domain?.collapsed),
    width: Number.isFinite(domain?.width)
      ? Math.max(DOMAIN_MIN_WIDTH, domain.width)
      : DOMAIN_DEFAULT_WIDTH,
    height: Number.isFinite(domain?.height)
      ? Math.max(DOMAIN_MIN_HEIGHT, domain.height)
      : DOMAIN_DEFAULT_HEIGHT,
    context: {
      ubiquitousLanguage: String(domain?.context?.ubiquitousLanguage || '').trim(),
      ownerTeam: String(domain?.context?.ownerTeam || '').trim(),
      upstreamDependencies: parseCommaSeparated(domain?.context?.upstreamDependencies || []),
      downstreamDependencies: parseCommaSeparated(domain?.context?.downstreamDependencies || []),
      integrationChannel: String(domain?.context?.integrationChannel || '').trim(),
      packageDependencies: parseCommaSeparated(domain?.context?.packageDependencies || []),
      sharedValueObjects: parseCommaSeparated(domain?.context?.sharedValueObjects || []),
      // JUM-492 (domain-package versioning, Requirement 126 Contract 3):
      // package identity and provenance are additive — carried only when the
      // source declares them, so pre-JUM-492 payloads are unchanged.
      ...(String(domain?.context?.packageName || '').trim()
        ? { packageName: String(domain.context.packageName).trim() }
        : {}),
      ...(String(domain?.context?.packageVersion || '').trim()
        ? { packageVersion: String(domain.context.packageVersion).trim() }
        : {}),
      ...(domain?.context?.provenance && typeof domain.context.provenance === 'object'
        ? {
          provenance: {
            package: String(domain.context.provenance.package || '').trim(),
            version: String(domain.context.provenance.version || '').trim()
          }
        }
        : {}),
      // JUM-491 (shared catalog sync): the catalog link is additive sync
      // metadata — carried only when the source declares it, exactly like the
      // JUM-492 package identity above, so non-shared domains are unchanged.
      ...(domain?.context?.catalog && typeof domain.context.catalog === 'object'
        ? {
          catalog: {
            id: String(domain.context.catalog.id || '').trim(),
            version: Number.isFinite(domain.context.catalog.version)
              ? domain.context.catalog.version
              : 0,
            contentHash: String(domain.context.catalog.contentHash || '')
          }
        }
        : {})
    },
    entities
  };
}

/**
 * Normalise a decoded `service-management.v1` payload (or a full-suite export
 * document, JUM-547) into the model slice the designer restores. The load
 * path restores the domain slice, deployments (migrated forward to the
 * Requirement 059 metadata contract by `normalizeDeploymentInput`, JUM-481)
 * and the generated-code workspace (JUM-736); the remaining pinned sections
 * (`interfaces`, `serviceConfiguration`, `runtimeEnvironment`, `activeTab`)
 * are intentionally not restored at load time. Since JUM-547/JUM-736 the sections
 * ARE normalised and returned here — the
 * full-suite import path (`buildStateFromSuiteExport`) applies them with the
 * same normalisation discipline as a load — so both crossings share one
 * normaliser.
 */
export function normalizeStatePayload(parsed) {
  const domainsInput = Array.isArray(parsed?.domains) ? parsed.domains : [];
  const domains = domainsInput.map((domain, domainIndex) => normalizeDomainInput(domain, domainIndex));
  const entityIds = new Set(domains.flatMap((domain) => domain.entities.map((entity) => entity.id)));
  const relationshipsInput = Array.isArray(parsed?.relationships) ? parsed.relationships : [];
  const relationships = relationshipsInput
    .map(normalizeRelationship)
    .filter((relationship) => entityIds.has(relationship.fromEntityId) && entityIds.has(relationship.toEntityId));
  const notesInput = Array.isArray(parsed?.notes) ? parsed.notes : [];
  const notes = notesInput.map(normalizeNote);
  const deploymentsInput = Array.isArray(parsed?.deployments) ? parsed.deployments : [];
  const deployments = deploymentsInput.map(normalizeDeploymentInput);
  const interfacesInput = Array.isArray(parsed?.interfaces) ? parsed.interfaces : [];
  const interfaces = interfacesInput.map(normalizeInterfaceInput);
  const serviceConfiguration = normalizeServiceConfigurationInput(parsed?.serviceConfiguration);
  const runtimeEnvironment = normalizeRuntimeEnvironmentInput(parsed?.runtimeEnvironment);
  const codeWorkspace = normalizeCodeWorkspaceInput(parsed?.codeWorkspace);
  const view = {
    zoom: clampZoom(parsed?.view?.zoom || 1),
    compactEntities: Boolean(parsed?.view?.compactEntities),
    // JUM-729 follow-up: which sidebar group is on screen, so a reload does not throw
    // the user back to Model in the middle of an inspector edit.
    sidebarGroup: ['model', 'inspector', 'quality', 'share'].includes(parsed?.view?.sidebarGroup)
      ? parsed.view.sidebarGroup
      : 'model',
    // JUM-729 follow-up: the panels overlay the canvas, so whether the drawer is open is
    // part of the view. Closed by default — the canvas is what the designer is
    // for, and a first run should show it whole.
    sidebarOpen: Boolean(parsed?.view?.sidebarOpen),
    snapToGrid: parsed?.view?.snapToGrid !== false,
    edgeStyle: ['curved', 'orthogonal'].includes(parsed?.view?.edgeStyle) ? parsed.view.edgeStyle : 'curved',
    modelCheckMinSeverity: ['info', 'warn', 'error'].includes(parsed?.view?.modelCheckMinSeverity)
      ? parsed.view.modelCheckMinSeverity
      : 'info',
    exportBlockCritical: parsed?.view?.exportBlockCritical !== false,
    largeCanvasMode: Boolean(parsed?.view?.largeCanvasMode)
  };
  return {
    domains,
    relationships,
    notes,
    selectedDomainId: parsed?.selectedDomainId || domains[0]?.id || null,
    selectedEntityId: parsed?.selectedEntityId || null,
    selectedRelationshipId: parsed?.selectedRelationshipId || null,
    idCounter: parsed?.idCounter || 1,
    interfaces,
    serviceConfiguration,
    runtimeEnvironment,
    codeWorkspace,
    deployments,
    view
  };
}

export function createDefaultView() {
  return {
    zoom: 1,
    compactEntities: false,
    sidebarGroup: 'model',
    sidebarOpen: false,
    snapToGrid: true,
    edgeStyle: 'curved',
    modelCheckMinSeverity: 'info',
    exportBlockCritical: true,
    largeCanvasMode: false
  };
}

/**
 * Create the designer's state/persistence core behind an `IDesignerStore`
 * port. The returned `state` and `history` objects are shared by reference:
 * the UI layer mutates `state` directly (as it always has) and every method
 * below observes the same objects.
 *
 * @param {Object} options
 * @param {import('../store/IDesignerStore.js').IDesignerStore} options.store -
 * storage port adapter. All persistence crosses this boundary.
 * @param {Function} options.seed - populate `state` with the default template.
 * @param {Function} options.render - re-render after undo/redo restores a snapshot.
 * @param {Object} [options.runtimeEnvDefaults] - default values for the
 * `runtimeEnvironment.values` section (owned by the UI layer's env metadata).
 * @param {Function} [options.onSaveResult] - `(saveResult, payload) => void`
 * observer invoked with every resolved save outcome (JUM-485): an `'unknown'`
 * outcome is surfaced and reconciled by the caller, never silently assumed
 * successful. Observation is fire-and-forget; persistence timing is unchanged.
 */
export function createDesignerState({ store, seed, render, runtimeEnvDefaults = {}, onSaveResult }) {
  const state = {
    domains: [],
    relationships: [],
    notes: [],
    selectedDomainId: null,
    selectedEntityId: null,
    selectedRelationshipId: null,
    idCounter: 1,
    activeTab: 'domain-designer',
    interfaces: [],
    serviceConfiguration: {
      serviceKind: 'rest-api',
      runMode: 'dedicated-server',
      cloudProvider: 'aws',
      staticAssetsPath: '',
      ports: {
        rest: 3000,
        websocket: 3001,
        grpc: 3002
      }
    },
    runtimeEnvironment: {
      environment: 'dev',
      fileName: '.env.dev',
      values: { ...runtimeEnvDefaults }
    },
    codeWorkspace: {
      files: {},
      activePath: ''
    },
    deployments: [],
    view: createDefaultView()
  };

  const history = {
    past: [],
    future: []
  };

  function snapshotState() {
    return JSON.parse(JSON.stringify({
      domains: state.domains,
      relationships: state.relationships,
      notes: state.notes,
      selectedDomainId: state.selectedDomainId,
      selectedEntityId: state.selectedEntityId,
      selectedRelationshipId: state.selectedRelationshipId,
      idCounter: state.idCounter,
      activeTab: state.activeTab,
      interfaces: state.interfaces,
      serviceConfiguration: state.serviceConfiguration,
      runtimeEnvironment: state.runtimeEnvironment,
      codeWorkspace: state.codeWorkspace,
      deployments: state.deployments,
      view: state.view
    }));
  }

  function applySnapshot(snapshot) {
    state.domains = snapshot.domains || [];
    state.relationships = (snapshot.relationships || []).map(normalizeRelationship);
    state.notes = (snapshot.notes || []).map(normalizeNote);
    state.selectedDomainId = snapshot.selectedDomainId || state.domains[0]?.id || null;
    state.selectedEntityId = snapshot.selectedEntityId || null;
    state.selectedRelationshipId = snapshot.selectedRelationshipId || null;
    state.idCounter = snapshot.idCounter || 1;
    state.activeTab = snapshot.activeTab || 'domain-designer';
    state.interfaces = Array.isArray(snapshot.interfaces) ? snapshot.interfaces : [];
    state.serviceConfiguration = {
      ...state.serviceConfiguration,
      ...(snapshot.serviceConfiguration || {})
    };
    state.runtimeEnvironment = {
      ...state.runtimeEnvironment,
      ...(snapshot.runtimeEnvironment || {})
    };
    state.codeWorkspace = normalizeCodeWorkspaceInput(snapshot.codeWorkspace);
    state.deployments = Array.isArray(snapshot.deployments)
      ? snapshot.deployments.map(normalizeDeploymentInput)
      : [];
    state.view = snapshot.view || { zoom: 1 };
    recomputeIdCounter();
  }

  function recomputeIdCounter() {
    const allIds = [];
    state.domains.forEach((domain) => {
      allIds.push(domain.id);
      domain.entities.forEach((entity) => allIds.push(entity.id));
    });
    state.relationships.forEach((relationship) => allIds.push(relationship.id));
    let max = 0;
    allIds.forEach((id) => {
      const parts = String(id).split('-');
      const numeric = Number(parts[parts.length - 1]);
      if (!Number.isNaN(numeric)) max = Math.max(max, numeric);
    });
    state.idCounter = Math.max(max + 1, 1);
  }

  /**
   * Persist the full `service-management.v1` document through the store. The
   * transitional adapter writes synchronously and resolves `'persisted'`, so
   * callers keep their pre-extraction fire-and-forget behaviour; the port
   * itself is async and callers must not depend on the timing. The result is
   * returned, and every resolved outcome is reported to the optional
   * `onSaveResult` observer (JUM-485) so an indeterminate write is reconciled
   * rather than assumed durable — the promise is never left unhandled.
   */
  function saveState() {
    const payload = {
      domains: state.domains,
      relationships: state.relationships,
      notes: state.notes,
      selectedDomainId: state.selectedDomainId,
      selectedEntityId: state.selectedEntityId,
      selectedRelationshipId: state.selectedRelationshipId,
      idCounter: state.idCounter,
      activeTab: state.activeTab,
      interfaces: state.interfaces,
      serviceConfiguration: state.serviceConfiguration,
      runtimeEnvironment: state.runtimeEnvironment,
      codeWorkspace: state.codeWorkspace,
      deployments: state.deployments,
      view: state.view
    };
    const result = store.save(payload);
    if (typeof onSaveResult === 'function') {
      Promise.resolve(result).then(
        (saveResult) => onSaveResult(saveResult, payload),
        (error) => onSaveResult({
          status: 'unknown',
          reason: `save-rejected: ${String((error && error.message) || error)}`
        }, payload)
      );
    }
    return result;
  }

  function recordHistory() {
    history.past.push(snapshotState());
    if (history.past.length > HISTORY_LIMIT) history.past.shift();
    history.future = [];
  }

  function withPersist(action, options = {}) {
    if (options.recordHistory !== false) recordHistory();
    action();
    saveState();
  }

  function undo() {
    if (!history.past.length) return;
    history.future.push(snapshotState());
    const previous = history.past.pop();
    applySnapshot(previous);
    saveState();
    render();
  }

  function redo() {
    if (!history.future.length) return;
    history.past.push(snapshotState());
    const next = history.future.pop();
    applySnapshot(next);
    saveState();
    render();
  }

  function clearHistory() {
    history.past = [];
    history.future = [];
  }

  /**
   * Load the persisted state through the store and restore the model slice.
   * Maps the port's load outcomes onto the pre-extraction behaviour:
   * - `'ok'` → normalise and apply (corrupt-but-decodable shapes fall into
   *   the same recovery path a `normalizeStatePayload` throw took before);
   * - `'empty'` → seed the default template and persist it (first run);
   * - `'lost'` → seed, persist the recovered state and reset the view (the
   *   old JSON.parse catch path);
   * - `'unavailable'` → seed in memory only — there is nothing behind the
   *   store to write to, and no fallback (decision 2026-07-29). The boot
   *   surfaces this through the declared storage-environment states
   *   (JUM-484, `canaMigration.js`) so the session is never silently
   *   non-persisting.
   *
   * Returns the outcome so the boot can announce it (JUM-626):
   * `{ status: 'ok'|'empty'|'unavailable'|'lost'|'recovered', reason? }` —
   * `'lost'` is the port's verdict, `'recovered'` is a decodable payload
   * whose normalisation still threw (the same silent-recovery shape as
   * `'lost'`, announced through the same `data-lost` declared state), and
   * `reason` carries the diagnostic the announcement names. Recovery itself
   * stays unchanged; only the silence is fixed.
   */
  async function loadState() {
    const result = await store.load();
    if (result.status === 'empty') {
      seed();
      saveState();
      clearHistory();
      return { status: 'empty' };
    }
    if (result.status === 'lost' || result.status === 'unavailable') {
      seed();
      if (result.status === 'lost') saveState();
      state.view = createDefaultView();
      clearHistory();
      return { status: result.status, reason: result.reason };
    }
    try {
      const parsed = normalizeStatePayload(result.payload);
      state.domains = parsed.domains;
      state.relationships = parsed.relationships;
      state.selectedDomainId = parsed.selectedDomainId;
      state.selectedEntityId = parsed.selectedEntityId;
      state.selectedRelationshipId = parsed.selectedRelationshipId;
      state.idCounter = parsed.idCounter;
      state.codeWorkspace = parsed.codeWorkspace;
      state.deployments = parsed.deployments;
      state.view = parsed.view;
      recomputeIdCounter();
      clearHistory();
      return { status: 'ok' };
    } catch (error) {
      seed();
      saveState();
      state.view = createDefaultView();
      clearHistory();
      return { status: 'recovered', reason: String((error && error.message) || error) };
    }
  }

  /**
   * Build the schema-diff baseline document (`{ domains, relationships }`),
   * pinned by Requirement 126 Contract 2.
   */
  function buildModelSnapshot() {
    const domains = state.domains.map((domain) => ({
      id: domain.id,
      name: domain.name,
      color: domain.color,
      context: domain.context || {},
      entities: domain.entities.map((entity) => ({
        id: entity.id,
        name: entity.name,
        meta: entity.meta || { aggregateRoot: false, invariants: [] },
        contracts: Array.isArray(entity?.meta?.contracts)
          ? entity.meta.contracts.map((contract, index) => normalizeContractInput(contract, index))
          : [],
        fields: entity.fields.map((field) => ({
          name: field.name,
          type: field.type,
          required: Boolean(field.required),
          pk: Boolean(field.pk),
          fk: Boolean(field.fk),
          unique: Boolean(field.unique),
          nullable: Boolean(field.nullable),
          format: field.format || '',
          itemsType: field.itemsType || '',
          enumValues: Array.isArray(field.enumValues) ? [...field.enumValues] : []
        }))
      }))
    }));
    const relationships = state.relationships.map((relationship) => ({
      id: relationship.id,
      fromEntityId: relationship.fromEntityId,
      toEntityId: relationship.toEntityId,
      fromCardinality: relationship.fromCardinality,
      toCardinality: relationship.toCardinality
    }));
    return { domains, relationships };
  }

  return {
    state,
    history,
    snapshotState,
    applySnapshot,
    recomputeIdCounter,
    saveState,
    recordHistory,
    withPersist,
    undo,
    redo,
    clearHistory,
    loadState,
    buildModelSnapshot
  };
}
