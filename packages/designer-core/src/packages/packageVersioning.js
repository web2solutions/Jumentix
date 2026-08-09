/**
 * packageVersioning — the semantic versioning, dependency-graph and
 * conflict-resolution core behind the designer's domain packages (JUM-492,
 * Requirement 126 Contract 3).
 *
 * A domain package is versioned data, not code, so the usual semver semantics
 * do not transfer directly. The meaning pinned by Requirement 126:
 *
 * - **patch** — documentation/metadata only (field descriptions, formats,
 *   domain context text, composition hints);
 * - **minor** — additive structure (a new entity, field or message contract;
 *   a required flag loosened);
 * - **major** — removal or narrowing (a removed entity/field/contract, a
 *   field type or PK/FK/unique change, a required flag tightened, an RBAC or
 *   invariant change, an aggregate declaration change).
 *
 * Conflict resolution is deterministic and explainable: additive (minor) and
 * metadata (patch) differences auto-merge, and every removal/narrowing —
 * with RBAC and invariants always in this class, because automatically
 * resolving a security policy is a decision a merge algorithm must not make —
 * keeps the existing designer content and is surfaced in the merge preview
 * for the user to reconcile. Re-importing the same version of the same
 * package is a no-op; the same version with different content and downgrades
 * are refused.
 *
 * Everything here is a pure function over plain objects — no DOM, no state
 * mutation — so the importer mapper and the JUM-471-style suites exercise it
 * under Bun/Node directly.
 */

/** Highest `domain-package` document major version the importer reads. */
export const DOMAIN_PACKAGE_KIND = 'domain-package';
export const DOMAIN_PACKAGE_VERSION = '2.0.0';
export const DOMAIN_PACKAGE_MAJOR = 2;

/** The version a package takes when the document declares none (legacy v1). */
export const DEFAULT_PACKAGE_VERSION = '1.0.0';

/**
 * Parse a strict `major.minor.patch` semantic version (an optional leading
 * `v` is tolerated). Returns `{ major, minor, patch }` or `null` — pre-release
 * and build suffixes are intentionally not part of the domain-package
 * versioning policy.
 */
export function parsePackageVersion(version) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(String(version || '').trim());
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3])
  };
}

/** Compare two versions (strings or parsed): -1, 0 or 1. Invalid sorts low. */
export function comparePackageVersions(a, b) {
  const pa = typeof a === 'string' ? parsePackageVersion(a) : a;
  const pb = typeof b === 'string' ? parsePackageVersion(b) : b;
  if (!pa && !pb) return 0;
  if (!pa) return -1;
  if (!pb) return 1;
  if (pa.major !== pb.major) return pa.major < pb.major ? -1 : 1;
  if (pa.minor !== pb.minor) return pa.minor < pb.minor ? -1 : 1;
  if (pa.patch !== pb.patch) return pa.patch < pb.patch ? -1 : 1;
  return 0;
}

/**
 * Parse a `context.packageDependencies` entry into `{ name, range }`. The
 * range is the part after the LAST `@` (a bare name means "any version — the
 * dependency is presence-only"). Entries without a name are dropped.
 */
export function parsePackageDependency(entry) {
  const raw = String(entry || '').trim();
  if (!raw) return null;
  const at = raw.lastIndexOf('@');
  if (at > 0) {
    return { name: raw.slice(0, at).trim(), range: raw.slice(at + 1).trim() || '*' };
  }
  return { name: raw.replace(/^@/, ''), range: '*' };
}

/**
 * Whether an installed version satisfies a dependency range. Accepted range
 * syntax (Requirement 126): `*`/empty (any), exact `1.2.3`, caret `^1.2.3`
 * (same major; for `0.x`, same minor — the npm convention) and tilde `~1.2.3`
 * (same major.minor). Anything else is an invalid range and satisfies
 * nothing, so it is reported rather than silently accepted.
 */
export function satisfiesPackageRange(version, range) {
  const parsed = parsePackageVersion(version);
  if (!parsed) return false;
  const spec = String(range || '').trim();
  if (!spec || spec === '*') return true;
  if (spec.startsWith('^') || spec.startsWith('~')) {
    const base = parsePackageVersion(spec.slice(1));
    if (!base) return false;
    if (comparePackageVersions(parsed, base) < 0) return false;
    if (spec.startsWith('~')) {
      return parsed.major === base.major && parsed.minor === base.minor;
    }
    if (base.major > 0) return parsed.major === base.major;
    if (base.minor > 0) return parsed.major === 0 && parsed.minor === base.minor;
    return parsed.major === 0 && parsed.minor === 0 && parsed.patch === base.patch;
  }
  const exact = parsePackageVersion(spec.replace(/^=/, ''));
  if (!exact) return false;
  return comparePackageVersions(parsed, exact) === 0;
}

/**
 * The installed-package registry of a model: one entry per package that
 * domains carry provenance for (`domain.context.provenance`, stamped at
 * import). A locally-built domain is NOT an installation — the registry
 * derives from provenance only, so importing a package named like a
 * hand-built domain appends instead of "merging" into unrelated content.
 * Entries carry the domain's declared dependencies
 * (`context.packageDependencies`, parsed). When legacy state carries two
 * domains from the same package, the highest version wins.
 *
 * @param {Array} domains - the model's domain list.
 * @returns {Map<string, { name: string, version: string, dependencies: Array, domain: Object }>}
 */
export function buildPackageRegistry(domains) {
  const registry = new Map();
  (Array.isArray(domains) ? domains : []).forEach((domain) => {
    const provenance = domain?.context?.provenance;
    const name = String(provenance?.package || '').trim();
    if (!name) return;
    const version = String(provenance?.version || '').trim() || DEFAULT_PACKAGE_VERSION;
    const dependencies = (Array.isArray(domain?.context?.packageDependencies)
      ? domain.context.packageDependencies
      : [])
      .map(parsePackageDependency)
      .filter(Boolean);
    const current = registry.get(name);
    if (!current || comparePackageVersions(version, current.version) > 0) {
      registry.set(name, { name, version, dependencies, domain });
    }
  });
  return registry;
}

/**
 * Resolve the dependency graph over a registry (optionally with an incoming
 * package overlaid) — transitive dependencies included. The result is
 * deterministic:
 *
 * - `order`: topological order, dependencies before dependents;
 * - `missing`: `{ name, range, requiredBy }` for declared dependencies no
 *   installed package provides;
 * - `incompatible`: `{ name, range, requiredBy, installed }` where the
 *   installed version falls outside the declared range;
 * - `cycles`: arrays of package names forming a cycle (reported, never
 *   entered — the walk marks nodes before recursing).
 *
 * @param {Map} registry - from `buildPackageRegistry`.
 * @param {Object} [incoming] - `{ name, version, dependencies }` overlaid
 * onto the registry (replacing a same-name entry) before resolution.
 */
export function resolvePackageGraph(registry, incoming = null) {
  const nodes = new Map();
  registry.forEach((entry, name) => {
    nodes.set(name, { name, version: entry.version, dependencies: entry.dependencies });
  });
  if (incoming && incoming.name) {
    nodes.set(incoming.name, {
      name: incoming.name,
      version: incoming.version,
      dependencies: Array.isArray(incoming.dependencies) ? incoming.dependencies : []
    });
  }

  const missing = [];
  const incompatible = [];
  nodes.forEach((node) => {
    node.dependencies.forEach((dependency) => {
      const installed = nodes.get(dependency.name);
      if (!installed) {
        missing.push({ name: dependency.name, range: dependency.range, requiredBy: node.name });
        return;
      }
      if (!satisfiesPackageRange(installed.version, dependency.range)) {
        incompatible.push({
          name: dependency.name,
          range: dependency.range,
          requiredBy: node.name,
          installed: installed.version
        });
      }
    });
  });

  // Kahn's algorithm over "dependency → dependent" edges restricted to
  // installed packages; whatever never reaches indegree zero is on (or
  // downstream of) a cycle, and a marked DFS names one concrete cycle path
  // per remaining component instead of looping forever.
  const edges = new Map();
  const indegree = new Map();
  nodes.forEach((node, name) => {
    edges.set(name, []);
    indegree.set(name, 0);
  });
  nodes.forEach((node) => {
    node.dependencies.forEach((dependency) => {
      if (!nodes.has(dependency.name)) return;
      edges.get(dependency.name).push(node.name);
      indegree.set(node.name, indegree.get(node.name) + 1);
    });
  });
  const queue = [...nodes.keys()].filter((name) => indegree.get(name) === 0).sort();
  const order = [];
  while (queue.length) {
    const name = queue.shift();
    order.push(name);
    edges.get(name).forEach((dependent) => {
      indegree.set(dependent, indegree.get(dependent) - 1);
      if (indegree.get(dependent) === 0) {
        queue.push(dependent);
        queue.sort();
      }
    });
  }

  const cycles = [];
  const remaining = new Set([...nodes.keys()].filter((name) => !order.includes(name)));
  const state = new Map(); // name → 'visiting' | 'done'
  const stack = [];
  const visit = (name) => {
    if (!remaining.has(name) || state.get(name) === 'done') return;
    if (state.get(name) === 'visiting') {
      cycles.push([...stack.slice(stack.indexOf(name)), name]);
      return;
    }
    state.set(name, 'visiting');
    stack.push(name);
    nodes.get(name).dependencies.forEach((dependency) => {
      if (nodes.has(dependency.name)) visit(dependency.name);
    });
    stack.pop();
    state.set(name, 'done');
  };
  [...remaining].sort().forEach((name) => visit(name));

  return { order, missing, incompatible, cycles };
}

/**
 * Normalise the package identity a `domain-package` document declares
 * (JUM-492). A v2 document carries a `package` block
 * (`{ name, version, dependencies }`); a legacy v1 document (no `package`
 * block, or none of the markers at all) is assigned the synthesized identity
 * `{ name: domain.name, version: '1.0.0', dependencies: [] }` so old files
 * keep importing. The document's own `version` major must not exceed
 * `DOMAIN_PACKAGE_MAJOR`.
 *
 * @returns {{ ok: true, package: Object } | { ok: false, reason: string, ... }}
 */
export function normalizePackageIdentity(parsed, sourceDomain) {
  if (parsed?.kind !== undefined && parsed.kind !== DOMAIN_PACKAGE_KIND) {
    return { ok: false, reason: 'wrong-document-kind', kind: parsed.kind };
  }
  if (parsed?.version !== undefined) {
    const major = Number.parseInt(String(parsed.version), 10);
    if (!Number.isFinite(major) || major > DOMAIN_PACKAGE_MAJOR) {
      return { ok: false, reason: 'unsupported-version', version: parsed.version };
    }
  }
  const block = parsed?.package;
  if (!block || typeof block !== 'object') {
    const fallbackName = String(sourceDomain?.name || '').trim() || 'package';
    return {
      ok: true,
      package: { name: fallbackName, version: DEFAULT_PACKAGE_VERSION, dependencies: [] }
    };
  }
  const name = String(block.name || '').trim();
  if (!name) {
    return { ok: false, reason: 'invalid-package' };
  }
  const version = String(block.version || '').trim() || DEFAULT_PACKAGE_VERSION;
  if (!parsePackageVersion(version)) {
    return { ok: false, reason: 'invalid-package-version', version: block.version };
  }
  const dependencies = (Array.isArray(block.dependencies) ? block.dependencies : [])
    .map((entry) => (entry && typeof entry === 'object'
      ? { name: String(entry.name || '').trim(), range: String(entry.range || '').trim() || '*' }
      : parsePackageDependency(entry)))
    .filter((entry) => entry && entry.name);
  return { ok: true, package: { name, version, dependencies } };
}

/** The provenance stamp applied to imported content. */
export function buildProvenance(packageInfo) {
  return { package: packageInfo.name, version: packageInfo.version };
}

/* ------------------------------------------------------------------------- *
 * Content projections — the basis for equality and conflict classification. *
 * Ids, provenance, layout (x/y), colour and the domain name are excluded:   *
 * they are import artifacts or presentational, not package content.         *
 * ------------------------------------------------------------------------- */

function fieldProjection(field) {
  return {
    name: field.name,
    type: field.type,
    required: Boolean(field.required),
    pk: Boolean(field.pk),
    fk: Boolean(field.fk),
    unique: Boolean(field.unique),
    nullable: Boolean(field.nullable),
    format: field.format || '',
    description: field.description || '',
    enumValues: Array.isArray(field.enumValues) ? [...field.enumValues] : [],
    pattern: field.pattern || '',
    minLength: field.minLength ?? null,
    maxLength: field.maxLength ?? null,
    minimum: field.minimum ?? null,
    maximum: field.maximum ?? null,
    itemsType: field.itemsType || ''
  };
}

function contractProjection(contract) {
  return {
    name: contract.name,
    type: contract.type,
    channel: contract.channel || '',
    version: contract.version || '',
    payloadSchema: contract.payloadSchema || {}
  };
}

function metaProjection(meta) {
  const source = meta || {};
  return {
    aggregateRoot: Boolean(source.aggregateRoot),
    invariants: Array.isArray(source.invariants) ? [...source.invariants] : [],
    rbac: source.rbac || {},
    contracts: (Array.isArray(source.contracts) ? source.contracts : []).map(contractProjection),
    oasComposition: {
      mode: source.oasComposition?.mode || '',
      refs: [...(source.oasComposition?.refs || [])].sort(),
      externalRefs: [...(source.oasComposition?.externalRefs || [])].sort(),
      discriminator: source.oasComposition?.discriminator || ''
    }
  };
}

function contextProjection(context) {
  const source = context || {};
  return {
    ubiquitousLanguage: source.ubiquitousLanguage || '',
    ownerTeam: source.ownerTeam || '',
    upstreamDependencies: [...(source.upstreamDependencies || [])].sort(),
    downstreamDependencies: [...(source.downstreamDependencies || [])].sort(),
    integrationChannel: source.integrationChannel || '',
    packageDependencies: [...(source.packageDependencies || [])].sort(),
    sharedValueObjects: [...(source.sharedValueObjects || [])].sort()
  };
}

function contentProjection(domain) {
  return {
    context: contextProjection(domain?.context),
    entities: (Array.isArray(domain?.entities) ? domain.entities : [])
      .map((entity) => ({
        name: entity.name,
        fields: (entity.fields || []).map(fieldProjection),
        meta: metaProjection(entity.meta)
      }))
      .sort((a, b) => String(a.name).localeCompare(String(b.name)))
  };
}

/**
 * Whether two normalised domains carry the same package content — the
 * idempotent re-import test. Ids, provenance, layout, colour and the domain
 * name are not content.
 */
export function packageContentsEqual(existingDomain, incomingDomain) {
  return JSON.stringify(contentProjection(existingDomain)) === JSON.stringify(contentProjection(incomingDomain));
}

/* ------------------------------------------------------------------------- *
 * Conflict classification and the deterministic merge.                       *
 * ------------------------------------------------------------------------- */

/** Conflict classes whose resolution is automatic (additive or metadata). */
export const AUTO_MERGE_CLASSES = new Set([
  'entity-added',
  'field-added',
  'field-required-loosened',
  'field-metadata-changed',
  'contract-added',
  'composition-changed',
  'context-changed'
]);

/**
 * Conflict classes that require a decision: the existing designer content is
 * kept for the aspect and the preview surfaces it. RBAC and invariants are
 * ALWAYS in this class — automatically resolving a security policy or a
 * domain invariant is a decision a merge algorithm must not make (JUM-492).
 */
export const REQUIRES_DECISION_CLASSES = new Set([
  'entity-removed',
  'field-removed',
  'field-type-changed',
  'field-required-tightened',
  'field-flags-changed',
  'contract-removed',
  'contract-changed',
  'rbac-changed',
  'invariants-changed',
  'aggregate-root-changed'
]);

function previewItem(conflictClass, severity, message, resolution) {
  return { class: conflictClass, severity, message, resolution };
}

const contractKey = (contract) => `${contract.type}|${contract.name}|${contract.version}`;

/**
 * Classify the differences between the installed domain and the incoming
 * (newer) package version and produce the merged domain plus the reviewable
 * merge preview. The merge is deterministic:
 *
 * - auto-merge classes apply the incoming change;
 * - requires-decision classes KEEP the existing designer content for that
 *   aspect and list it in the preview with `resolution:
 *   'kept-existing-requires-decision'`;
 * - provenance advances to the incoming version on the domain and on every
 *   entity the incoming package touches; entities that exist only in the
 *   designer keep theirs.
 *
 * Entity matching is by name (ids are recomputed at import, JUM-617, so they
 * can never be the match key). New incoming entities receive ids that do not
 * collide with the model through the importer's `uniqueId` callback.
 *
 * @param {Object} existingDomain - the installed domain (from provenance).
 * @param {Object} incomingDomain - the normalised incoming package domain.
 * @param {Object} packageInfo - `{ name, version }` of the incoming package.
 * @param {Object} [options] - `{ uniqueId: (id, prefix, seed) => id }`.
 * @returns {{ domain: Object, preview: Array, autoCount: number, requiresDecision: number }}
 */
export function buildPackageMerge(existingDomain, incomingDomain, packageInfo, options = {}) {
  const uniqueId = options.uniqueId || ((id) => id);
  const provenance = buildProvenance(packageInfo);
  const preview = [];
  let autoCount = 0;
  let requiresDecision = 0;
  const auto = (conflictClass, message) => {
    autoCount += 1;
    preview.push(previewItem(conflictClass, 'info', message, 'auto-applied'));
  };
  const decision = (conflictClass, message) => {
    requiresDecision += 1;
    preview.push(previewItem(conflictClass, 'warn', message, 'kept-existing-requires-decision'));
  };

  const label = (entityName) => `${existingDomain.name}/${entityName}`;
  const existingByName = new Map(
    (existingDomain.entities || []).map((entity) => [entity.name, entity])
  );
  const incomingByName = new Map(
    (incomingDomain.entities || []).map((entity) => [entity.name, entity])
  );

  const mergedEntities = (existingDomain.entities || []).map((existingEntity) => {
    const incomingEntity = incomingByName.get(existingEntity.name);
    if (!incomingEntity) {
      decision('entity-removed', `Package no longer carries entity "${label(existingEntity.name)}" — kept as-is; remove it explicitly if the removal was intended.`);
      return existingEntity;
    }
    const entityLabelText = label(existingEntity.name);
    const existingFields = new Map((existingEntity.fields || []).map((field) => [field.name, field]));
    const incomingFields = new Map((incomingEntity.fields || []).map((field) => [field.name, field]));

    const mergedFields = (existingEntity.fields || []).map((existingField) => {
      const incomingField = incomingFields.get(existingField.name);
      if (!incomingField) {
        decision('field-removed', `Package removes field "${entityLabelText}.${existingField.name}" — kept; remove it explicitly if intended.`);
        return existingField;
      }
      const merged = { ...existingField };
      if (existingField.type !== incomingField.type || existingField.itemsType !== incomingField.itemsType) {
        decision('field-type-changed', `Package changes the type of "${entityLabelText}.${existingField.name}" from ${existingField.type}${existingField.itemsType ? `(${existingField.itemsType})` : ''} to ${incomingField.type}${incomingField.itemsType ? `(${incomingField.itemsType})` : ''} — kept ${existingField.type}${existingField.itemsType ? `(${existingField.itemsType})` : ''}.`);
      }
      if (['pk', 'fk', 'unique'].some((flag) => Boolean(existingField[flag]) !== Boolean(incomingField[flag]))) {
        decision('field-flags-changed', `Package changes PK/FK/unique flags on "${entityLabelText}.${existingField.name}" — kept the existing flags.`);
      }
      if (Boolean(existingField.required) !== Boolean(incomingField.required)) {
        if (incomingField.required) {
          decision('field-required-tightened', `Package makes "${entityLabelText}.${existingField.name}" required — kept it optional; tighten it explicitly if intended.`);
        } else {
          merged.required = false;
          auto('field-required-loosened', `Field "${entityLabelText}.${existingField.name}" is no longer required.`);
        }
      }
      const metadataKeys = ['format', 'description', 'pattern', 'minLength', 'maxLength', 'minimum', 'maximum'];
      const metadataChanged = metadataKeys.some((key) => (existingField[key] ?? null) !== (incomingField[key] ?? null))
        || Boolean(existingField.nullable) !== Boolean(incomingField.nullable)
        || JSON.stringify(existingField.enumValues || []) !== JSON.stringify(incomingField.enumValues || []);
      if (metadataChanged) {
        metadataKeys.forEach((key) => {
          merged[key] = incomingField[key];
        });
        merged.nullable = Boolean(incomingField.nullable);
        merged.enumValues = Array.isArray(incomingField.enumValues) ? [...incomingField.enumValues] : [];
        auto('field-metadata-changed', `Metadata of "${entityLabelText}.${existingField.name}" updated (description/format/constraints/nullability).`);
      }
      return merged;
    });
    (incomingEntity.fields || []).forEach((incomingField) => {
      if (existingFields.has(incomingField.name)) return;
      mergedFields.push({ ...incomingField });
      auto('field-added', `Add field "${entityLabelText}.${incomingField.name}" (${incomingField.type}).`);
    });

    const existingMeta = metaProjection(existingEntity.meta);
    const incomingMeta = metaProjection(incomingEntity.meta);
    const mergedMeta = { ...(existingEntity.meta || {}) };

    const existingContracts = new Map((existingMeta.contracts || []).map((contract) => [contractKey(contract), contract]));
    const incomingContracts = new Map((incomingMeta.contracts || []).map((contract) => [contractKey(contract), contract]));
    const mergedContracts = [...(existingEntity.meta?.contracts || [])];
    incomingContracts.forEach((incomingContract, key) => {
      if (!existingContracts.has(key)) {
        const source = (incomingEntity.meta?.contracts || []).find((contract) => contractKey(contractProjection(contract)) === key);
        mergedContracts.push(source ? { ...source } : incomingContract);
        auto('contract-added', `Add message contract "${entityLabelText}" -> ${key}.`);
        return;
      }
      const existingContract = existingContracts.get(key);
      if (JSON.stringify(contractProjection(existingContract)) !== JSON.stringify(incomingContract)) {
        decision('contract-changed', `Package changes message contract "${entityLabelText}" -> ${key} (channel or payload) — kept the existing contract.`);
      }
    });
    existingContracts.forEach((contract, key) => {
      if (!incomingContracts.has(key)) {
        decision('contract-removed', `Package removes message contract "${entityLabelText}" -> ${key} — kept; remove it explicitly if intended.`);
      }
    });
    mergedMeta.contracts = mergedContracts;

    if (Boolean(existingMeta.aggregateRoot) !== Boolean(incomingMeta.aggregateRoot)) {
      decision('aggregate-root-changed', `Package changes the aggregate declaration of "${entityLabelText}" — kept the existing declaration.`);
    }
    if (JSON.stringify(existingMeta.invariants) !== JSON.stringify(incomingMeta.invariants)) {
      decision('invariants-changed', `Package changes the invariants of "${entityLabelText}" — kept the existing invariants; reconcile them explicitly (invariants never auto-merge).`);
    }
    if (JSON.stringify(existingMeta.rbac) !== JSON.stringify(incomingMeta.rbac)) {
      decision('rbac-changed', `Package changes the RBAC policy of "${entityLabelText}" — kept the existing policy; reconcile it explicitly (RBAC never auto-merges).`);
    }
    if (JSON.stringify(existingMeta.oasComposition) !== JSON.stringify(incomingMeta.oasComposition)) {
      mergedMeta.oasComposition = { ...(incomingEntity.meta?.oasComposition || {}) };
      auto('composition-changed', `OAS composition hints of "${entityLabelText}" updated.`);
    }
    mergedMeta.provenance = provenance;

    return {
      ...existingEntity,
      fields: mergedFields,
      meta: mergedMeta
    };
  });

  let appended = 0;
  (incomingDomain.entities || []).forEach((incomingEntity) => {
    if (existingByName.has(incomingEntity.name)) return;
    const entity = {
      ...incomingEntity,
      id: uniqueId(incomingEntity.id, 'entity', appended),
      meta: { ...(incomingEntity.meta || {}), provenance }
    };
    appended += 1;
    mergedEntities.push(entity);
    auto('entity-added', `Create entity "${existingDomain.name}/${incomingEntity.name}".`);
  });

  const existingContext = contextProjection(existingDomain.context);
  const incomingContext = contextProjection(incomingDomain.context);
  const mergedContext = { ...(existingDomain.context || {}) };
  if (JSON.stringify(existingContext) !== JSON.stringify(incomingContext)) {
    ['ubiquitousLanguage', 'ownerTeam', 'upstreamDependencies', 'downstreamDependencies',
      'integrationChannel', 'packageDependencies', 'sharedValueObjects'].forEach((key) => {
      mergedContext[key] = Array.isArray(incomingDomain.context?.[key])
        ? [...incomingDomain.context[key]]
        : String(incomingDomain.context?.[key] || '').trim();
    });
    auto('context-changed', `Domain context metadata of "${existingDomain.name}" updated.`);
  }
  mergedContext.packageName = packageInfo.name;
  mergedContext.packageVersion = packageInfo.version;
  mergedContext.provenance = provenance;

  return {
    domain: {
      ...existingDomain,
      context: mergedContext,
      entities: mergedEntities
    },
    preview,
    autoCount,
    requiresDecision
  };
}

/**
 * Build the preview for a same-version-different-content refusal: every
 * differing aspect listed as a refused conflict, so the user can see why the
 * import stopped (version immutability — same version, different content is
 * a broken package, never a silent pick).
 */
export function buildSameVersionConflictPreview(existingDomain, incomingDomain, packageInfo) {
  const merge = buildPackageMerge(existingDomain, incomingDomain, packageInfo);
  return merge.preview.map((item) => ({
    ...item,
    severity: 'error',
    resolution: 'refused-same-version-conflict'
  }));
}
