/**
 * designerImporters — the pure document→model mapping behind the designer's
 * three import paths, extracted from `script.js` by JUM-469.
 *
 * - `buildDomainFromPackage` backs `importDomainPackage`;
 * - `buildDomainsFromOas` backs `importStateFromOasFile`;
 * - `buildStateFromSuiteExport` backs `importStateFromFile` (JUM-547): the
 *   document→model step is `normalizeStatePayload` from
 *   `src/state/designerState.js` (JUM-468), wrapped in the full-suite
 *   document's versioning and compatibility rules.
 *
 * Both mappers are pure functions over parsed JSON: document in, result out.
 * No `FileReader`, no `window.alert`, no state mutation — the file-reading
 * and persistence glue stays in `script.js`, so this module imports and runs
 * under Bun/Node with no DOM shim (the JUM-471 round-trip suite's
 * precondition). `buildDomainsFromOas` was extended by JUM-478 to normalise
 * the entity meta
 * extension set (`x-aggregate-root`/`x-invariants`/`x-rbac`/
 * `x-message-contracts`/composition/`x-fieldless`/`x-field-flags`), to restore
 * relationships from top-level `x-relations`, and to recognise unmarked port
 * objects by the canonical naming/description conventions, so the OAS
 * crossing is lossless for designer-exported documents.
 *
 * Result shape: `{ ok: true, ... }` on success, `{ ok: false, reason }` with
 * a stable machine-readable reason on failure, so the caller keeps mapping
 * exactly one reason to exactly one pre-refactor alert.
 * `buildDomainFromPackage` carries the monolith's append rules, extended by
 * JUM-617 (colliding ids recomputed) and by JUM-492 (domain-package
 * versioning: provenance stamping, dependency-graph resolution and the
 * deterministic merge/no-op/refusal conflict policy of Requirement 126
 * Contract 3, implemented in `src/packages/packageVersioning.js`).
 */

import {
  DOMAIN_COLORS,
  defaultFields,
  fallbackId,
  normalizeContractInput,
  normalizeDomainInput,
  normalizeField,
  normalizeOptionalNumber,
  normalizeRbacPolicyInput,
  normalizeRelationship,
  normalizeStatePayload,
  parseCommaSeparated,
  parseEnumValues,
  SUITE_EXPORT_KIND,
  SUITE_EXPORT_MAJOR
} from '../state/designerState.js';
import {
  fromOasType,
  isDomainNameTaken,
  oasFieldNameFlags,
  uniqueStrings
} from '../model/modelQueries.js';
import {
  buildPackageMerge,
  buildPackageRegistry,
  buildProvenance,
  buildSameVersionConflictPreview,
  comparePackageVersions,
  normalizePackageIdentity,
  packageContentsEqual,
  resolvePackageGraph
} from '../packages/packageVersioning.js';

/**
 * Resolve an imported id against the ids already taken: an id that is free
 * crosses verbatim; an id that collides with the model — or repeats within
 * the package itself — is recomputed on the OAS fallback-id convention
 * (`fallbackId(prefix, seed)`), so re-importing the same package never
 * yields two domains sharing domain/entity ids (JUM-617).
 */
function uniqueImportedId(id, prefix, seed, takenIds) {
  if (!id || takenIds.has(id)) {
    let candidate = fallbackId(prefix, seed);
    while (takenIds.has(candidate)) {
      candidate = fallbackId(prefix, seed);
    }
    takenIds.add(candidate);
    return candidate;
  }
  takenIds.add(id);
  return id;
}

/**
 * Map a parsed `domain-package` document to a normalised domain ready to
 * append — or, since JUM-492, to a version-aware merge/no-op/refusal when
 * the package is already installed. Package/shared-value-object lists are
 * deduped and the name is suffixed (`_2`, `_3`, ...) until it does not
 * collide with an existing domain — exactly the monolith's rules. Layout
 * comes from `normalizeDomainInput` seeded at `existingDomains.length`, as
 * before. Domain/entity ids cross verbatim only while they are free;
 * colliding ids are recomputed (JUM-617, see `uniqueImportedId`).
 *
 * The JUM-492 versioning layer (Requirement 126 Contract 3) runs before the
 * append rules:
 *
 * - The document's package identity is normalised (`normalizePackageIdentity`):
 *   a legacy v1 document synthesises `{ name: domain.name, version: 1.0.0 }`;
 *   an unparseable version fails `invalid-package-version`, a document major
 *   newer than the importer fails `unsupported-version`.
 * - The installed-package registry (domains carrying provenance) is resolved
 *   as a dependency graph: missing and range-incompatible dependencies are
 *   reported as `warnings` (the import proceeds — the designer is not the
 *   resolver, only the reporter), and a dependency cycle the incoming
 *   package participates in fails `dependency-cycle` (cycles are reported,
 *   never entered).
 * - Re-importing an installed package: the same version with equal content
 *   is a no-op (`noop: true` — idempotent re-import); the same version with
 *   different content fails `same-version-conflict` (version immutability);
 *   an older version fails `downgrade-rejected`; a newer version merges
 *   deterministically (`buildPackageMerge`) — additive/metadata changes
 *   apply, removals and narrowings (RBAC and invariants always) keep the
 *   existing content and are listed in the `preview` for the user.
 * - Imported content is stamped with provenance
 *   (`context.provenance`/`packageName`/`packageVersion` on the domain,
 *   `meta.provenance` on every entity), so the designer knows which package
 *   and version each piece of content came from.
 *
 * @param {Object} parsed - decoded JSON of the uploaded package file.
 * @param {Array} existingDomains - domains already in the model.
 * @returns {{ ok: true, domain: Object, ... } | { ok: false, reason: string, ... }}
 */
export function buildDomainFromPackage(parsed, existingDomains) {
  const sourceDomain = parsed?.domain;
  if (!sourceDomain || !Array.isArray(sourceDomain.entities)) {
    return { ok: false, reason: 'invalid-package' };
  }
  const identity = normalizePackageIdentity(parsed, sourceDomain);
  if (!identity.ok) {
    return identity;
  }
  const packageInfo = identity.package;
  const nextDomain = normalizeDomainInput(sourceDomain, existingDomains.length);
  const takenIds = new Set();
  existingDomains.forEach((domain) => {
    if (domain?.id) takenIds.add(domain.id);
    (Array.isArray(domain?.entities) ? domain.entities : []).forEach((entity) => {
      if (entity?.id) takenIds.add(entity.id);
    });
  });
  nextDomain.context = nextDomain.context || {};
  nextDomain.context.packageDependencies = uniqueStrings(nextDomain.context.packageDependencies || []);
  nextDomain.context.sharedValueObjects = uniqueStrings(nextDomain.context.sharedValueObjects || []);

  // Dependency graph (JUM-492): the registry derives from provenance only,
  // and the incoming package is overlaid before resolution so its own
  // dependencies are checked against what is — and would be — installed.
  const registry = buildPackageRegistry(existingDomains);
  const graph = resolvePackageGraph(registry, packageInfo);
  const incomingCycle = graph.cycles.find((cycle) => cycle.includes(packageInfo.name));
  if (incomingCycle) {
    return { ok: false, reason: 'dependency-cycle', cycle: incomingCycle, package: packageInfo };
  }
  const warnings = [
    ...graph.missing.map((entry) => (
      `Package '${entry.requiredBy}' depends on '${entry.name}@${entry.range}', which is not imported.`
    )),
    ...graph.incompatible.map((entry) => (
      `Package '${entry.requiredBy}' requires '${entry.name}@${entry.range}' but '${entry.name}@${entry.installed}' is imported.`
    )),
    ...graph.cycles.map((cycle) => (
      `Dependency cycle reported (not entered): ${cycle.join(' -> ')}.`
    ))
  ];

  const installed = registry.get(packageInfo.name);
  if (installed) {
    const comparison = comparePackageVersions(packageInfo.version, installed.version);
    if (comparison === 0) {
      if (packageContentsEqual(installed.domain, nextDomain)) {
        return { ok: true, noop: true, package: packageInfo, domain: installed.domain };
      }
      return {
        ok: false,
        reason: 'same-version-conflict',
        package: packageInfo,
        installed: installed.version,
        preview: buildSameVersionConflictPreview(installed.domain, nextDomain, packageInfo)
      };
    }
    if (comparison < 0) {
      return {
        ok: false,
        reason: 'downgrade-rejected',
        package: packageInfo,
        installed: installed.version
      };
    }
    const merge = buildPackageMerge(installed.domain, nextDomain, packageInfo, {
      uniqueId: (id, prefix, seed) => uniqueImportedId(id, prefix, seed, takenIds)
    });
    return {
      ok: true,
      merged: true,
      package: packageInfo,
      fromVersion: installed.version,
      domain: merge.domain,
      preview: merge.preview,
      autoCount: merge.autoCount,
      requiresDecision: merge.requiresDecision,
      warnings
    };
  }

  nextDomain.id = uniqueImportedId(nextDomain.id, 'domain', existingDomains.length, takenIds);
  nextDomain.entities.forEach((entity, entityIndex) => {
    entity.id = uniqueImportedId(entity.id, 'entity', entityIndex, takenIds);
  });
  let domainName = nextDomain.name;
  let suffix = 2;
  while (isDomainNameTaken(existingDomains, domainName)) {
    domainName = `${nextDomain.name}_${suffix}`;
    suffix += 1;
  }
  nextDomain.name = domainName;
  // Provenance stamping (JUM-492): the domain and every imported entity
  // record which package and version they came from.
  const provenance = buildProvenance(packageInfo);
  nextDomain.context.packageName = packageInfo.name;
  nextDomain.context.packageVersion = packageInfo.version;
  nextDomain.context.provenance = provenance;
  nextDomain.entities.forEach((entity) => {
    entity.meta = { ...(entity.meta || {}), provenance };
  });
  return { ok: true, domain: nextDomain, package: packageInfo, warnings };
}

/**
 * Whether a schema declares an object contract — entities are object
 * contracts, so foreign scalar/array schemas (for example the canonical
 * `BooleanStringResult`) are not entity candidates at all (JUM-478).
 */
function isObjectContractSchema(schemaValue) {
  return schemaValue.type === 'object'
    || (schemaValue.properties && typeof schemaValue.properties === 'object')
    || Array.isArray(schemaValue.oneOf)
    || Array.isArray(schemaValue.allOf)
    || Array.isArray(schemaValue.anyOf);
}

/**
 * Whether a schema is a derived port object rather than model content
 * (JUM-478). The designer's own documents mark wrappers with
 * `'x-port-object': true` and entity schemas with `x-domain`/`x-entity`, so
 * marked documents are decided by the markers alone. Unmarked documents (the
 * canonical `spec/1.0.0.yml`) follow the same port-object conventions by name
 * and description: `Request<Action>*` inputs, `<Schema>ArrayOf` collection
 * wrappers, the shared `ResourceDeleteResponse`, and any schema described as
 * a "Port input/output object" that is not a `<Name> resource` entity
 * contract. What remains must still be an object contract to become an
 * entity.
 */
function isPortObjectSchema(schemaKey, schemaValue) {
  if (schemaValue['x-port-object'] === true) return true;
  if (schemaValue['x-entity'] || schemaValue['x-domain']) return false;
  if (schemaKey === 'ResourceDeleteResponse') return true;
  if (/^Request[A-Z]/.test(schemaKey) || /ArrayOf$/.test(schemaKey)) return true;
  const description = String(schemaValue.description || '');
  if (/^Port (input|output) object/.test(description) && !/^Port output object for .+ resource\./.test(description)) {
    return true;
  }
  return !isObjectContractSchema(schemaValue);
}

/**
 * The composition mode a schema declares, if any: the first of
 * `oneOf`/`allOf`/`anyOf` present as an array.
 */
function compositionModeOf(schemaValue) {
  return ['oneOf', 'allOf', 'anyOf'].find((mode) => Array.isArray(schemaValue[mode])) || '';
}

/** Strip the local schemas prefix from a `$ref`, keeping anything else verbatim. */
function schemaRefName(ref) {
  return String(ref || '').replace(/^#\/components\/schemas\//, '').trim();
}

/**
 * Normalise the entity meta a schema carries in the JUM-478 extension set
 * back into the designer's `meta` shape — the same shape
 * `normalizeEntityInput` produces, so an imported entity is
 * indistinguishable from a UI-built one.
 */
function buildEntityMetaFromOas(schemaValue) {
  const invariantsInput = schemaValue['x-invariants'];
  const invariants = Array.isArray(invariantsInput)
    ? invariantsInput.map((item) => String(item).trim()).filter(Boolean)
    : parseCommaSeparated(invariantsInput || []);
  const contracts = Array.isArray(schemaValue['x-message-contracts'])
    ? schemaValue['x-message-contracts'].map((contract, index) => normalizeContractInput(contract, index))
    : [];
  const mode = compositionModeOf(schemaValue);
  const refs = mode
    ? schemaValue[mode].map((entry) => schemaRefName(entry?.$ref)).filter(Boolean)
    : [];
  return {
    aggregateRoot: schemaValue['x-aggregate-root'] === true,
    invariants,
    rbac: normalizeRbacPolicyInput(schemaValue['x-rbac']),
    contracts,
    oasComposition: {
      mode,
      refs,
      externalRefs: parseCommaSeparated(schemaValue['x-external-refs'] || []),
      discriminator: String(schemaValue?.discriminator?.propertyName || '').trim()
    }
  };
}

/**
 * Map a parsed OpenAPI document to the designer's domain list: one entity
 * per `components.schemas` entry, grouped by `x-domain`, fields mapped back
 * through `fromOasType` — except port input/output wrappers, which are
 * derived artifacts decided by `isPortObjectSchema` and skipped. Entity meta
 * (aggregate declaration, invariants, RBAC, message contracts, composition)
 * is normalised back from the JUM-478 extension set, and top-level
 * `x-relations` rows restore the model's relationships by schema name. View
 * state is NOT part of this mapping — the caller resets it, exactly as the
 * monolith did.
 *
 * @param {Object} parsed - decoded JSON of the uploaded OAS file.
 * @returns {{ ok: true, domains: Array, relationships: Array } | { ok: false, reason: 'invalid-oas' | 'no-schemas' }}
 */
export function buildDomainsFromOas(parsed) {
  const schemas = parsed?.components?.schemas;
  if (!schemas || typeof schemas !== 'object') {
    return { ok: false, reason: 'invalid-oas' };
  }

  const nextDomains = [];
  const byDomain = new Map();
  const entityBySchema = new Map();
  let domainIndex = 0;
  let entityIndex = 0;

  Object.entries(schemas).forEach(([schemaKey, schemaValue]) => {
    if (!schemaValue || typeof schemaValue !== 'object') return;
    if (isPortObjectSchema(schemaKey, schemaValue)) return;
    const domainName = String(schemaValue['x-domain'] || 'Imported').trim() || 'Imported';
    const entityName = String(schemaValue['x-entity'] || schemaKey).trim() || schemaKey;
    const required = Array.isArray(schemaValue.required) ? schemaValue.required : [];
    const properties = schemaValue.properties && typeof schemaValue.properties === 'object'
      ? schemaValue.properties
      : {};

    let domain = byDomain.get(domainName);
    if (!domain) {
      domain = {
        id: fallbackId('domain', domainIndex),
        name: domainName,
        color: DOMAIN_COLORS[domainIndex % DOMAIN_COLORS.length],
        x: 120 + domainIndex * 40,
        y: 90 + domainIndex * 30,
        entities: []
      };
      domainIndex += 1;
      byDomain.set(domainName, domain);
      nextDomains.push(domain);
    }

    const fields = Object.entries(properties).map(([fieldName, fieldSchema]) => {
      const field = fieldSchema || {};
      // PK/FK/unique default to the name heuristic; an explicit
      // `x-field-flags` extension (JUM-478) overrides it per flag.
      const heuristic = oasFieldNameFlags(fieldName);
      const flagOverrides = field['x-field-flags'] && typeof field['x-field-flags'] === 'object'
        ? field['x-field-flags']
        : {};
      const flag = (key) => (typeof flagOverrides[key] === 'boolean' ? flagOverrides[key] : heuristic[key]);
      return normalizeField({
        name: fieldName,
        type: fromOasType(field),
        format: String(field.format || '').trim(),
        description: String(field.description || '').trim(),
        nullable: Boolean(field.nullable),
        enumValues: parseEnumValues(field.enum),
        pattern: String(field.pattern || '').trim(),
        minLength: normalizeOptionalNumber(field.minLength),
        maxLength: normalizeOptionalNumber(field.maxLength),
        minimum: normalizeOptionalNumber(field.minimum),
        maximum: normalizeOptionalNumber(field.maximum),
        itemsType: fromOasType(field.items || {}),
        required: required.includes(fieldName),
        pk: flag('pk'),
        fk: flag('fk'),
        unique: flag('unique')
      }, 0);
    });

    const entity = {
      id: fallbackId('entity', entityIndex),
      name: entityName,
      x: 14 + (domain.entities.length % 2) * 206,
      y: 14 + Math.floor(domain.entities.length / 2) * 120,
      // A marked fieldless entity keeps its empty field set; an unmarked
      // schema without properties keeps the legacy default-fields fallback.
      fields: fields.length ? fields : (schemaValue['x-fieldless'] === true ? [] : defaultFields()),
      meta: buildEntityMetaFromOas(schemaValue)
    };
    domain.entities.push(entity);
    entityBySchema.set(schemaKey, entity);
    entityIndex += 1;
  });

  if (!nextDomains.length) {
    return { ok: false, reason: 'no-schemas' };
  }

  // Relationships cross by schema name (`x-relations`, JUM-478): endpoints
  // resolve to the freshly imported entities, and rows pointing at schemas
  // that did not import (dangling or port-object refs) are dropped — exactly
  // the rule `normalizeStatePayload` applies to dangling model ids.
  const relationships = [];
  const relationsInput = Array.isArray(parsed['x-relations']) ? parsed['x-relations'] : [];
  relationsInput.forEach((relation) => {
    const fromEntity = entityBySchema.get(relation?.fromSchema);
    const toEntity = entityBySchema.get(relation?.toSchema);
    if (!fromEntity || !toEntity) return;
    relationships.push(normalizeRelationship({
      id: fallbackId('relationship', relationships.length),
      name: String(relation.name || '').trim() || `${relation.fromSchema} -> ${relation.toSchema}`,
      fromEntityId: fromEntity.id,
      toEntityId: toEntity.id,
      fromCardinality: relation.fromCardinality,
      toCardinality: relation.toCardinality
    }));
  });

  return { ok: true, domains: nextDomains, relationships };
}


/**
 * Sections a full-suite export document may carry (JUM-547): the Requirement
 * 126 Contract 2 storage sections plus the document's own `kind`/`version`
 * markers. Anything else is an unknown section — the import fails clearly
 * rather than silently discarding it (forward compatibility).
 */
const SUITE_EXPORT_KNOWN_SECTIONS = new Set([
  'kind',
  'version',
  'domains',
  'relationships',
  'selectedDomainId',
  'selectedEntityId',
  'selectedRelationshipId',
  'idCounter',
  'activeTab',
  'interfaces',
  'serviceConfiguration',
  'runtimeEnvironment',
  'deployments',
  'view'
]);

/**
 * Map a parsed full-suite export document (`domain-designer.json`) to the
 * normalised state `importStateFromFile` applies (JUM-547). The
 * document→model step is `normalizeStatePayload`, so the crossing applies the
 * same normalisation discipline as a load; this wrapper owns the document
 * rules:
 *
 * - **Backward compatibility.** A pre-JUM-547 domain-only document (no
 *   `kind`/`version`, only `{ domains, relationships, view }`) imports
 *   cleanly; the missing sections take the designer defaults.
 * - **Versioning.** A document with no `version` is the legacy shape; a
 *   `version` whose major is at most `SUITE_EXPORT_MAJOR` imports. A newer
 *   major fails with `unsupported-version` instead of half-importing.
 * - **Forward compatibility.** An unknown top-level section fails with
 *   `unknown-sections` (named) — it never vanishes silently. A `kind` that
 *   is not the suite kind fails with `wrong-document-kind` (a domain package
 *   or boilerplate bundle fed to the wrong import no longer "succeeds" as an
 *   empty model).
 * - **The recorded `runtimeEnvironment` decision** (Requirement 126 Contract
 *   3): bundles carry the environment selection, never `values`. When the
 *   document carries no `values`, the local machine's values
 *   (`currentState.runtimeEnvironment.values`) are preserved across the
 *   import; a document that does carry `values` (a raw
 *   `service-management.v1` payload dump) restores them.
 *
 * @param {Object} parsed - decoded JSON of the uploaded file.
 * @param {Object} [currentState] - the live designer state (for the
 * runtime-environment values preservation rule).
 * @returns {{ ok: true, state: Object } | { ok: false, reason: string, ... }}
 */
export function buildStateFromSuiteExport(parsed, currentState) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, reason: 'invalid-document' };
  }
  if (parsed.kind !== undefined && parsed.kind !== SUITE_EXPORT_KIND) {
    return { ok: false, reason: 'wrong-document-kind', kind: parsed.kind };
  }
  if (parsed.version !== undefined) {
    const major = Number.parseInt(String(parsed.version), 10);
    if (!Number.isFinite(major) || major > SUITE_EXPORT_MAJOR) {
      return { ok: false, reason: 'unsupported-version', version: parsed.version };
    }
  }
  const unknownSections = Object.keys(parsed).filter((key) => !SUITE_EXPORT_KNOWN_SECTIONS.has(key));
  if (unknownSections.length) {
    return { ok: false, reason: 'unknown-sections', sections: unknownSections };
  }
  const state = normalizeStatePayload(parsed);
  const documentCarriesValues = parsed.runtimeEnvironment
    && typeof parsed.runtimeEnvironment === 'object'
    && parsed.runtimeEnvironment.values !== undefined
    && parsed.runtimeEnvironment.values !== null;
  const localValues = currentState?.runtimeEnvironment?.values;
  if (!documentCarriesValues && localValues && typeof localValues === 'object' && !Array.isArray(localValues)) {
    state.runtimeEnvironment = { ...state.runtimeEnvironment, values: { ...localValues } };
  }
  return { ok: true, state };
}
