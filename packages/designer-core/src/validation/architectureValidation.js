/**
 * architectureValidation — Core rule, domain assignment and link protocol
 * checks for the Architecture designer (JUM-815).
 */

import {
  ARCHITECTURE_LINK_PROTOCOLS,
  isUsersDomain,
  normalizeArchitectureInput,
  protocolInterfaceType,
  serviceForDomain
} from '../model/architecture.js';
import { findEntity } from '../model/modelQueries.js';

/**
 * @typedef {Object} ModelIssue
 * @property {string} message
 * @property {?string} entityId
 * @property {'error'|'warn'|'info'} severity
 */

export function collectArchitectureIssues(state) {
  const issues = [];
  const pushIssue = (message, entityId = null, severity = 'error') => {
    issues.push({ message, entityId, severity });
  };
  const architecture = normalizeArchitectureInput(state?.architecture, state?.domains);
  const services = Array.isArray(architecture.services) ? architecture.services : [];
  const links = Array.isArray(architecture.links) ? architecture.links : [];
  const domains = Array.isArray(state?.domains) ? state.domains : [];
  const cores = services.filter((service) => service.kind === 'core');

  if (cores.length !== 1) {
    pushIssue(
      cores.length === 0
        ? 'Architecture must include exactly one Core service.'
        : 'Architecture must include exactly one Core service; extra Core services are not allowed.',
      null,
      'error'
    );
  }

  const usersDomain = domains.find((domain) => isUsersDomain(domain));
  if (usersDomain && cores.length === 1 && !cores[0].domains.includes(usersDomain.id)) {
    pushIssue('The Core service must contain the Users domain.', usersDomain.id, 'error');
  }
  if (!usersDomain && domains.length && (state?.architecture?.services || []).length) {
    pushIssue('Architecture Core rule requires a Users domain for authentication.', null, 'warn');
  }

  const assignmentCounts = new Map();
  services.forEach((service) => {
    (service.domains || []).forEach((domainId) => {
      assignmentCounts.set(domainId, (assignmentCounts.get(domainId) || 0) + 1);
    });
  });
  domains.forEach((domain) => {
    const count = assignmentCounts.get(domain.id) || 0;
    if (count === 0) {
      pushIssue(`Domain "${domain.name}" is not assigned to a service.`, domain.id, 'error');
    }
    if (count > 1) {
      pushIssue(`Domain "${domain.name}" is assigned to more than one service.`, domain.id, 'error');
    }
  });

  const interfaceTypes = new Set(
    (Array.isArray(state?.interfaces) ? state.interfaces : [])
      .map((entry) => String(entry?.type || '').trim())
      .filter(Boolean)
  );

  links.forEach((link) => {
    if (!ARCHITECTURE_LINK_PROTOCOLS.includes(link.protocol)) {
      pushIssue(`Link "${link.id}" uses unsupported protocol "${link.protocol}".`, null, 'error');
      return;
    }
    if (interfaceTypes.size) {
      const needed = protocolInterfaceType(link.protocol);
      if (!interfaceTypes.has(needed)) {
        pushIssue(
          `Link "${link.from}" → "${link.to}" uses ${link.protocol}, which no declared interface adapter supports.`,
          null,
          'error'
        );
      }
    }
  });

  (Array.isArray(state?.relationships) ? state.relationships : []).forEach((relationship) => {
    const from = findEntity(domains, relationship.fromEntityId);
    const to = findEntity(domains, relationship.toEntityId);
    if (!from || !to) return;
    const fromService = serviceForDomain(architecture, from.domain.id);
    const toService = serviceForDomain(architecture, to.domain.id);
    if (fromService && toService && fromService.id !== toService.id) {
      pushIssue(
        `x-relation "${relationship.name || relationship.id}" crosses the ${fromService.name} / ${toService.name} service boundary.`,
        from.entity.id,
        'warn'
      );
    }
  });

  return issues;
}
