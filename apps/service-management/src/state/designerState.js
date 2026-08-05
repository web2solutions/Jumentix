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
 * sections written through the store.
 */

export const DOMAIN_COLORS = ['#60a5fa', '#34d399', '#f59e0b', '#f472b6', '#22d3ee', '#a78bfa', '#fb7185', '#84cc16'];
export const FIELD_TYPES = ['string', 'integer', 'number', 'boolean', 'array', 'object', 'date', 'datetime', 'uuid'];

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

export function normalizeRelationship(relationship) {
  return {
    ...relationship,
    name: relationship.name || `${relationship.fromEntityId} -> ${relationship.toEntityId}`,
    fromCardinality: relationship.fromCardinality || 'N',
    toCardinality: relationship.toCardinality || '1',
    fromAnchorSide: ['top', 'right', 'bottom', 'left'].includes(relationship.fromAnchorSide) ? relationship.fromAnchorSide : null,
    toAnchorSide: ['top', 'right', 'bottom', 'left'].includes(relationship.toAnchorSide) ? relationship.toAnchorSide : null,
    anchorBehavior: relationship.anchorBehavior === 'center' ? 'center' : 'auto',
    bendX: normalizeOptionalNumber(relationship.bendX),
    bendY: normalizeOptionalNumber(relationship.bendY),
    labelOffsetX: normalizeOptionalNumber(relationship.labelOffsetX) ?? 0,
    labelOffsetY: normalizeOptionalNumber(relationship.labelOffsetY) ?? 0
  };
}

export function getDefaultRbacPolicy() {
  return {
    list: { roles: ['superadmin', 'admin'], tenantScoped: true },
    getById: { roles: ['superadmin', 'admin', 'user'], tenantScoped: true },
    create: { roles: ['superadmin', 'admin'], tenantScoped: true },
    update: { roles: ['superadmin', 'admin'], tenantScoped: true },
    delete: { roles: ['superadmin', 'admin'], tenantScoped: true }
  };
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
  const rbac = getDefaultRbacPolicy();
  const sourceRbac = entity?.meta?.rbac || {};
  ['list', 'getById', 'create', 'update', 'delete'].forEach((action) => {
    const rule = sourceRbac[action] || rbac[action] || {};
    rbac[action] = {
      roles: Array.isArray(rule.roles)
        ? rule.roles.map((role) => String(role).trim()).filter(Boolean)
        : Array.isArray(rbac[action]?.roles)
          ? rbac[action].roles
          : [],
      tenantScoped: typeof rule.tenantScoped === 'boolean' ? rule.tenantScoped : Boolean(rbac[action]?.tenantScoped)
    };
  });
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
      oasComposition
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
    context: {
      ubiquitousLanguage: String(domain?.context?.ubiquitousLanguage || '').trim(),
      ownerTeam: String(domain?.context?.ownerTeam || '').trim(),
      upstreamDependencies: parseCommaSeparated(domain?.context?.upstreamDependencies || []),
      downstreamDependencies: parseCommaSeparated(domain?.context?.downstreamDependencies || []),
      integrationChannel: String(domain?.context?.integrationChannel || '').trim(),
      packageDependencies: parseCommaSeparated(domain?.context?.packageDependencies || []),
      sharedValueObjects: parseCommaSeparated(domain?.context?.sharedValueObjects || [])
    },
    entities
  };
}

/**
 * Normalise a decoded `service-management.v1` payload into the model slice the
 * designer restores on load. Kept identical to the pre-extraction behaviour:
 * only `domains`, `relationships`, the three selections, `idCounter` and
 * `view` come back — the other pinned sections are intentionally not restored
 * at load time.
 */
export function normalizeStatePayload(parsed) {
  const domainsInput = Array.isArray(parsed?.domains) ? parsed.domains : [];
  const domains = domainsInput.map((domain, domainIndex) => normalizeDomainInput(domain, domainIndex));
  const entityIds = new Set(domains.flatMap((domain) => domain.entities.map((entity) => entity.id)));
  const relationshipsInput = Array.isArray(parsed?.relationships) ? parsed.relationships : [];
  const relationships = relationshipsInput
    .map(normalizeRelationship)
    .filter((relationship) => entityIds.has(relationship.fromEntityId) && entityIds.has(relationship.toEntityId));
  const view = {
    zoom: clampZoom(parsed?.view?.zoom || 1),
    compactEntities: Boolean(parsed?.view?.compactEntities),
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
    selectedDomainId: parsed?.selectedDomainId || domains[0]?.id || null,
    selectedEntityId: parsed?.selectedEntityId || null,
    selectedRelationshipId: parsed?.selectedRelationshipId || null,
    idCounter: parsed?.idCounter || 1,
    view
  };
}

export function createDefaultView() {
  return {
    zoom: 1,
    compactEntities: false,
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
 */
export function createDesignerState({ store, seed, render, runtimeEnvDefaults = {} }) {
  const state = {
    domains: [],
    relationships: [],
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
      selectedDomainId: state.selectedDomainId,
      selectedEntityId: state.selectedEntityId,
      selectedRelationshipId: state.selectedRelationshipId,
      idCounter: state.idCounter,
      activeTab: state.activeTab,
      interfaces: state.interfaces,
      serviceConfiguration: state.serviceConfiguration,
      runtimeEnvironment: state.runtimeEnvironment,
      deployments: state.deployments,
      view: state.view
    }));
  }

  function applySnapshot(snapshot) {
    state.domains = snapshot.domains || [];
    state.relationships = (snapshot.relationships || []).map(normalizeRelationship);
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
    state.deployments = Array.isArray(snapshot.deployments) ? snapshot.deployments : [];
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
   * itself is async and callers must not depend on the timing.
   */
  function saveState() {
    const payload = {
      domains: state.domains,
      relationships: state.relationships,
      selectedDomainId: state.selectedDomainId,
      selectedEntityId: state.selectedEntityId,
      selectedRelationshipId: state.selectedRelationshipId,
      idCounter: state.idCounter,
      activeTab: state.activeTab,
      interfaces: state.interfaces,
      serviceConfiguration: state.serviceConfiguration,
      runtimeEnvironment: state.runtimeEnvironment,
      deployments: state.deployments,
      view: state.view
    };
    store.save(payload);
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
   *   store to write to, and no fallback (decision 2026-07-29).
   */
  async function loadState() {
    const result = await store.load();
    if (result.status === 'empty') {
      seed();
      saveState();
      clearHistory();
      return;
    }
    if (result.status === 'lost' || result.status === 'unavailable') {
      seed();
      if (result.status === 'lost') saveState();
      state.view = createDefaultView();
      clearHistory();
      return;
    }
    try {
      const parsed = normalizeStatePayload(result.payload);
      state.domains = parsed.domains;
      state.relationships = parsed.relationships;
      state.selectedDomainId = parsed.selectedDomainId;
      state.selectedEntityId = parsed.selectedEntityId;
      state.selectedRelationshipId = parsed.selectedRelationshipId;
      state.idCounter = parsed.idCounter;
      state.view = parsed.view;
      recomputeIdCounter();
      clearHistory();
    } catch (error) {
      seed();
      saveState();
      state.view = createDefaultView();
      clearHistory();
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
