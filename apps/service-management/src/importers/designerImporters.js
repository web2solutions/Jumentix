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
 * precondition). Mapping logic is verbatim from the monolith: same
 * normalisation, same dedup rules, same fallback layout.
 *
 * Result shape: `{ ok: true, ... }` on success, `{ ok: false, reason }` with
 * a stable machine-readable reason on failure, so the caller keeps mapping
 * exactly one reason to exactly one pre-refactor alert.
 */

import {
  DOMAIN_COLORS,
  defaultFields,
  fallbackId,
  normalizeDomainInput,
  normalizeField,
  normalizeOptionalNumber,
  parseEnumValues
} from '../state/designerState.js';
import {
  fromOasType,
  isDomainNameTaken,
  uniqueStrings
} from '../model/modelQueries.js';

/**
 * Map a parsed `domain-package` document to a normalised domain ready to
 * append. Package/shared-value-object lists are deduped and the name is
 * suffixed (`_2`, `_3`, ...) until it does not collide with an existing
 * domain — exactly the monolith's rules. Layout comes from
 * `normalizeDomainInput` seeded at `existingDomains.length`, as before.
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
 * Map a parsed OpenAPI document to the designer's domain list: one entity
 * per `components.schemas` entry, grouped by `x-domain`, fields mapped back
 * through `fromOasType`. Relationship and view state are NOT part of this
 * mapping — the caller resets them, exactly as the monolith did.
 *
 * @param {Object} parsed - decoded JSON of the uploaded OAS file.
 * @returns {{ ok: true, domains: Array } | { ok: false, reason: 'invalid-oas' | 'no-schemas' }}
 */
export function buildDomainsFromOas(parsed) {
  const schemas = parsed?.components?.schemas;
  if (!schemas || typeof schemas !== 'object') {
    return { ok: false, reason: 'invalid-oas' };
  }

  const nextDomains = [];
  const byDomain = new Map();
  let domainIndex = 0;
  let entityIndex = 0;

  Object.entries(schemas).forEach(([schemaKey, schemaValue]) => {
    if (!schemaValue || typeof schemaValue !== 'object') return;
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
        pk: fieldName === 'id',
        fk: /id$/i.test(fieldName) && fieldName !== 'id',
        unique: fieldName === 'id'
      }, 0);
    });

    domain.entities.push({
      id: fallbackId('entity', entityIndex),
      name: entityName,
      x: 14 + (domain.entities.length % 2) * 206,
      y: 14 + Math.floor(domain.entities.length / 2) * 120,
      fields: fields.length ? fields : defaultFields()
    });
    entityIndex += 1;
  });

  if (!nextDomains.length) {
    return { ok: false, reason: 'no-schemas' };
  }
  return { ok: true, domains: nextDomains };
}
