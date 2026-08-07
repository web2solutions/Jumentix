/**
 * designerImporters — the pure document→model mapping behind the designer's
 * three import paths, extracted from `script.js` by JUM-469.
 *
 * - `buildDomainFromPackage` backs `importDomainPackage`;
 * - `buildDomainsFromOas` backs `importStateFromOasFile`;
 * - `importStateFromFile` needs no mapper of its own: its document→model step
 *   IS `normalizeStatePayload` from `src/state/designerState.js` (JUM-468).
 *
 * Both mappers are pure functions over parsed JSON: document in, result out.
 * No `FileReader`, no `window.alert`, no state mutation — the file-reading
 * and persistence glue stays in `script.js`, so this module imports and runs
 * under Bun/Node with no DOM shim (the JUM-471 round-trip suite's
 * precondition). `buildDomainFromPackage` is verbatim from the monolith;
 * `buildDomainsFromOas` was extended by JUM-478 to normalise the entity meta
 * extension set (`x-aggregate-root`/`x-invariants`/`x-rbac`/
 * `x-message-contracts`/composition/`x-fieldless`/`x-field-flags`), to restore
 * relationships from top-level `x-relations`, and to recognise unmarked port
 * objects by the canonical naming/description conventions, so the OAS
 * crossing is lossless for designer-exported documents.
 *
 * Result shape: `{ ok: true, ... }` on success, `{ ok: false, reason }` with
 * a stable machine-readable reason on failure, so the caller keeps mapping
 * exactly one reason to exactly one pre-refactor alert.
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
  parseCommaSeparated,
  parseEnumValues
} from '../state/designerState.js';
import {
  fromOasType,
  isDomainNameTaken,
  oasFieldNameFlags,
  uniqueStrings
} from '../model/modelQueries.js';

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
 * append. Package/shared-value-object lists are deduped and the name is
 * suffixed (`_2`, `_3`, ...) until it does not collide with an existing
 * domain — exactly the monolith's rules. Layout comes from
 * `normalizeDomainInput` seeded at `existingDomains.length`, as before.
 * Domain/entity ids cross verbatim only while they are free; colliding ids
 * are recomputed (JUM-617, see `uniqueImportedId`).
 *
 * @param {Object} parsed - decoded JSON of the uploaded package file.
 * @param {Array} existingDomains - domains already in the model.
 * @returns {{ ok: true, domain: Object } | { ok: false, reason: 'invalid-package' }}
 */
export function buildDomainFromPackage(parsed, existingDomains) {
  const sourceDomain = parsed?.domain;
  if (!sourceDomain || !Array.isArray(sourceDomain.entities)) {
    return { ok: false, reason: 'invalid-package' };
  }
  const nextDomain = normalizeDomainInput(sourceDomain, existingDomains.length);
  const takenIds = new Set();
  existingDomains.forEach((domain) => {
    if (domain?.id) takenIds.add(domain.id);
    (Array.isArray(domain?.entities) ? domain.entities : []).forEach((entity) => {
      if (entity?.id) takenIds.add(entity.id);
    });
  });
  nextDomain.id = uniqueImportedId(nextDomain.id, 'domain', existingDomains.length, takenIds);
  nextDomain.entities.forEach((entity, entityIndex) => {
    entity.id = uniqueImportedId(entity.id, 'entity', entityIndex, takenIds);
  });
  nextDomain.context = nextDomain.context || {};
  nextDomain.context.packageDependencies = uniqueStrings(nextDomain.context.packageDependencies || []);
  nextDomain.context.sharedValueObjects = uniqueStrings(nextDomain.context.sharedValueObjects || []);
  const existingDeps = new Set(
    existingDomains.flatMap((domain) => domain?.context?.packageDependencies || [])
  );
  const incomingNewDeps = nextDomain.context.packageDependencies.filter((dep) => !existingDeps.has(dep));
  if (incomingNewDeps.length) {
    nextDomain.context.packageDependencies = uniqueStrings([
      ...nextDomain.context.packageDependencies,
      ...incomingNewDeps
    ]);
  }
  let domainName = nextDomain.name;
  let suffix = 2;
  while (isDomainNameTaken(existingDomains, domainName)) {
    domainName = `${nextDomain.name}_${suffix}`;
    suffix += 1;
  }
  nextDomain.name = domainName;
  return { ok: true, domain: nextDomain };
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
