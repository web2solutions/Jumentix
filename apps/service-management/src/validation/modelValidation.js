/**
 * modelValidation — the designer's model-validation engine, extracted from
 * `script.js` by JUM-469.
 *
 * `collectModelIssues` is a pure function over the state object: state in,
 * issue list out. No `document`, no `window` — the rendering of results
 * (`renderModelCheckResults`) and the export gate's alert stay in the UI
 * layer, so this module imports and runs under Bun/Node with no DOM shim
 * (the JUM-470 validation suite's precondition). The normalisers it relies
 * on live in `src/state/designerState.js` (JUM-468) and
 * `src/model/modelQueries.js`.
 *
 * Rules, messages and severities are verbatim from the monolith: for the
 * same state the issue list is identical, in the same order — plus the
 * JUM-477 contract-parity rule, which reports (as an `error`, so the export
 * gate blocks it) any RBAC role outside the tenant authorization contract's
 * enforceable vocabulary.
 */

import {
  normalizeOptionalNumber,
  parseCommaSeparated
} from '../state/designerState.js';
import {
  isContractRole
} from '../model/rbacContract.js';
import {
  findEntity,
  getEntityRbacPolicy,
  normalizedName,
  toPathToken,
  toSchemaName
} from '../model/modelQueries.js';

/**
 * @typedef {Object} ModelIssue
 * @property {string} message
 * @property {?string} entityId - entity to focus when the issue is clicked.
 * @property {'error'|'warn'|'info'} severity
 */

/**
 * Collect every model issue the designer reports, in the monolith's exact
 * order: per domain (name, then per entity — name, fields, primary key,
 * invariants, RBAC, contracts, OAS composition), then per relationship.
 *
 * @param {Object} state - designer state (`domains`, `relationships`).
 * @returns {ModelIssue[]}
 */
export function collectModelIssues(state) {
  const issues = [];
  const pushIssue = (message, entityId = null, severity = 'error') => issues.push({ message, entityId, severity });
  const seenDomainNames = new Set();
  // JUM-474: the OAS export derives schema names and route paths from the
  // domain/entity names through a lossy tokenisation — distinct names can
  // collapse onto the same token (`Foo Bar` and `Foo-Bar` both become
  // `foo-bar`). A collision silently overwrites a path/schema in the exported
  // document, so it is an export-gate-blocking error, not a warning.
  const seenOasSchemaNames = new Map();
  const seenOasRoutePaths = new Map();

  state.domains.forEach((domain) => {
    const domainNameKey = normalizedName(domain.name);
    if (!domain.name || !domainNameKey) {
      pushIssue('Domain with empty name found.', null, 'error');
    }
    if (seenDomainNames.has(domainNameKey)) {
      pushIssue(`Duplicate domain name: ${domain.name}`, null, 'error');
    }
    seenDomainNames.add(domainNameKey);

    const seenEntityNames = new Set();
    domain.entities.forEach((entity) => {
      const entityKey = normalizedName(entity.name);
      if (!entity.name || !entityKey) {
        pushIssue(`Entity with empty name in domain ${domain.name}`, entity.id, 'error');
      }
      if (seenEntityNames.has(entityKey)) {
        pushIssue(`Duplicate entity name in domain ${domain.name}: ${entity.name}`, entity.id, 'error');
      }
      seenEntityNames.add(entityKey);

      const seenFields = new Set();
      let hasPrimaryKey = false;
      entity.fields.forEach((field) => {
        const fieldKey = normalizedName(field.name);
        if (!field.name || !fieldKey) {
          pushIssue(`Entity ${domain.name}/${entity.name} has an empty field name.`, entity.id, 'error');
        }
        if (seenFields.has(fieldKey)) {
          pushIssue(`Entity ${domain.name}/${entity.name} has duplicated field: ${field.name}`, entity.id, 'error');
        }
        seenFields.add(fieldKey);
        if (field.type === 'array' && !field.itemsType) {
          pushIssue(`Field ${domain.name}/${entity.name}.${field.name} is array but has no itemsType.`, entity.id, 'error');
        }
        if (field.minLength !== null && field.maxLength !== null && field.minLength > field.maxLength) {
          pushIssue(`Field ${domain.name}/${entity.name}.${field.name} has minLength > maxLength.`, entity.id, 'error');
        }
        if (field.minimum !== null && field.maximum !== null && field.minimum > field.maximum) {
          pushIssue(`Field ${domain.name}/${entity.name}.${field.name} has minimum > maximum.`, entity.id, 'error');
        }
        if (field.pk) hasPrimaryKey = true;
        if (field.required && field.nullable) {
          pushIssue(`Field ${domain.name}/${entity.name}.${field.name} is required and nullable simultaneously.`, entity.id, 'warn');
        }
      });
      if (!hasPrimaryKey) {
        pushIssue(`Entity ${domain.name}/${entity.name} has no primary key field.`, entity.id, 'error');
      }
      if (!entity?.meta?.aggregateRoot && Array.isArray(entity?.meta?.invariants) && entity.meta.invariants.length > 0) {
        pushIssue(`Entity ${domain.name}/${entity.name} has invariants but is not marked as aggregate root.`, entity.id, 'warn');
      }
      const policy = getEntityRbacPolicy(entity);
      ['list', 'getById', 'create', 'update', 'delete'].forEach((action) => {
        const roles = Array.isArray(policy?.[action]?.roles) ? policy[action].roles : [];
        if (!roles.length) {
          pushIssue(`Entity ${domain.name}/${entity.name} has no RBAC roles for action "${action}".`, entity.id, 'warn');
        }
        roles.forEach((role) => {
          if (!isContractRole(role)) {
            pushIssue(`Entity ${domain.name}/${entity.name} RBAC action "${action}" references role "${role}", which the tenant authorization contract cannot enforce.`, entity.id, 'error');
          }
        });
      });
      const contracts = Array.isArray(entity?.meta?.contracts) ? entity.meta.contracts : [];
      contracts.forEach((contract) => {
        if (!contract?.name) {
          pushIssue(`Entity ${domain.name}/${entity.name} has a contract without name.`, entity.id, 'error');
        }
        if (!contract?.channel) {
          pushIssue(`Contract ${domain.name}/${entity.name}.${contract?.name || 'unknown'} has empty channel/topic.`, entity.id, 'warn');
        }
      });
      const composition = entity?.meta?.oasComposition || {};
      const mode = ['oneOf', 'allOf', 'anyOf'].includes(composition.mode) ? composition.mode : '';
      const refs = parseCommaSeparated(composition.refs || []);
      if (mode && refs.length < 2) {
        pushIssue(`Entity ${domain.name}/${entity.name} composition "${mode}" should reference at least 2 schemas.`, entity.id, 'warn');
      }
      if (composition.discriminator && !mode) {
        pushIssue(`Entity ${domain.name}/${entity.name} has discriminator without composition mode.`, entity.id, 'warn');
      }

      const entityLabelText = `${domain.name}/${entity.name}`;
      const oasSchemaName = toSchemaName(domain.name, entity.name);
      if (seenOasSchemaNames.has(oasSchemaName)) {
        pushIssue(
          `Entities ${seenOasSchemaNames.get(oasSchemaName)} and ${entityLabelText} resolve to the same OAS schema name: ${oasSchemaName}`,
          entity.id,
          'error'
        );
      } else {
        seenOasSchemaNames.set(oasSchemaName, entityLabelText);
      }
      const oasRoutePath = `/${toPathToken(domain.name)}/${toPathToken(entity.name)}`;
      if (seenOasRoutePaths.has(oasRoutePath)) {
        pushIssue(
          `Entities ${seenOasRoutePaths.get(oasRoutePath)} and ${entityLabelText} resolve to the same OAS route path: ${oasRoutePath}`,
          entity.id,
          'error'
        );
      } else {
        seenOasRoutePaths.set(oasRoutePath, entityLabelText);
      }
    });
  });

  state.relationships.forEach((relationship) => {
    const from = findEntity(state.domains, relationship.fromEntityId);
    const to = findEntity(state.domains, relationship.toEntityId);
    if (!from || !to) {
      pushIssue(`Relationship "${relationship.name || relationship.id}" references missing entities.`, null, 'error');
    }
    if (!['1', 'N'].includes(relationship.fromCardinality) || !['1', 'N'].includes(relationship.toCardinality)) {
      pushIssue(`Relationship "${relationship.name || relationship.id}" has invalid cardinality.`, null, 'error');
    }
    const bendX = normalizeOptionalNumber(relationship.bendX);
    const bendY = normalizeOptionalNumber(relationship.bendY);
    if ((bendX === null) !== (bendY === null)) {
      pushIssue(`Relationship "${relationship.name || relationship.id}" should define both bendX and bendY or none.`, null, 'warn');
    }
  });

  return issues;
}
