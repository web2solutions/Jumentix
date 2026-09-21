/**
 * Named validation / resolution messages (exit code 1). Keep stable for tests and docs.
 */

export const SOURCE_MESSAGES = Object.freeze({
  NO_CORE_SERVICE: 'GenerationPlan validation failed: no core service.',
  ENTITY_WITHOUT_PRIMARY_KEY: (entityName: string, domainId: string) => (
    `GenerationPlan validation failed: entity "${entityName}" in domain "${domainId}" has no primary key.`
  ),
  RELATION_CROSSING_BOUNDARY: (relationName: string, fromService: string, toService: string) => (
    `GenerationPlan validation failed: relation "${relationName}" crosses service boundary `
    + `(${fromService} / ${toService}) in monolith mode.`
  ),
  UNSUPPORTED_INTERFACE: (serviceId: string, kind: 'http' | 'realtime', value: string) => (
    `GenerationPlan validation failed: unsupported ${kind} interface "${value}" on service "${serviceId}".`
  ),
  DUPLICATE_ENTITY_NAMES: (entityName: string, domainA: string, domainB: string) => (
    `GenerationPlan validation failed: duplicate entity name "${entityName}" across domains `
    + `"${domainA}" and "${domainB}".`
  ),
  INVALID_FROM: (from: string) => (
    `Source resolution failed: --from="${from}" is not a readable file or http(s) catalog URL.`
  ),
  INVALID_PRESET: (preset: string) => (
    `Source resolution failed: unsupported --preset="${preset}" (supported: users).`
  ),
  INVALID_OAS: 'Source resolution failed: document is not a valid OpenAPI 3.x object with components.schemas.',
  INVALID_DESIGNER_EXPORT: (reason: string) => (
    `Source resolution failed: designer export rejected (${reason}).`
  ),
  CATALOG_FETCH_FAILED: (url: string, detail: string) => (
    `Source resolution failed: catalog fetch failed for ${url}: ${detail}.`
  ),
  UNSUPPORTED_MODE: (mode: string) => (
    `Source resolution failed: unsupported --mode="${mode}".`
  )
});
