/**
 * architecture — designer-core model for services, domain assignment and
 * communication links (JUM-815).
 *
 * A monolith is exactly one Core service that holds every domain. Core must
 * host the Users domain (identity + authentication). Domain ids appear on
 * exactly one service. Links are directional and carry a protocol the
 * Communication Interface Designer vocabulary understands.
 *
 * Geometry (`x`, `y`, `width`, `height`) lives on each service so the
 * Architecture canvas can persist layout without a second store.
 */

import { normalizedName } from './modelQueries.js';

function fallbackId(prefix, seed) {
  return `${prefix}-import-${seed}-${Math.random().toString(36).slice(2, 8)}`;
}

function parseCommaSeparated(raw) {
  if (Array.isArray(raw)) return raw.map((item) => String(item).trim()).filter(Boolean);
  return String(raw || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export const ARCHITECTURE_SERVICE_KINDS = Object.freeze(['core', 'domain']);
export const ARCHITECTURE_LINK_PROTOCOLS = Object.freeze(['rest', 'grpc', 'websocket', 'message']);
export const CORE_SERVICE_ID = 'core';
export const CORE_SERVICE_DEFAULT_URL = 'http://localhost:3000/api/1.0.0';
export const USERS_DOMAIN_NAME = 'Users';
export const ARCHITECTURE_SERVICE_MIN_WIDTH = 220;
export const ARCHITECTURE_SERVICE_MIN_HEIGHT = 140;
export const ARCHITECTURE_SERVICE_DEFAULT_WIDTH = 280;
export const ARCHITECTURE_SERVICE_DEFAULT_HEIGHT = 200;

const PROTOCOL_TO_INTERFACE = {
  rest: 'http-rest',
  grpc: 'grpc',
  websocket: 'websocket',
  message: 'sse'
};

export function isUsersDomain(domain) {
  return normalizedName(domain?.name) === normalizedName(USERS_DOMAIN_NAME);
}

export function findUsersDomain(domains) {
  return (Array.isArray(domains) ? domains : []).find((domain) => isUsersDomain(domain)) || null;
}

export function buildMonolithArchitecture(domains, options = {}) {
  const list = Array.isArray(domains) ? domains : [];
  const url = String(options.url || CORE_SERVICE_DEFAULT_URL).trim() || CORE_SERVICE_DEFAULT_URL;
  return {
    services: [
      {
        id: CORE_SERVICE_ID,
        name: 'Core',
        kind: 'core',
        url,
        domains: list.map((domain) => domain.id).filter(Boolean),
        deployTargetId: String(options.deployTargetId || '').trim(),
        x: 80,
        y: 80,
        width: ARCHITECTURE_SERVICE_DEFAULT_WIDTH,
        height: ARCHITECTURE_SERVICE_DEFAULT_HEIGHT
      }
    ],
    links: []
  };
}

export function normalizeArchitectureService(entry, index, knownDomainIds) {
  const source = entry || {};
  const kind = ARCHITECTURE_SERVICE_KINDS.includes(source.kind) ? source.kind : 'domain';
  const id = String(source.id || '').trim()
    || (kind === 'core' ? CORE_SERVICE_ID : fallbackId('service', index));
  const domainIds = parseCommaSeparated(source.domains || [])
    .filter((domainId) => !knownDomainIds || knownDomainIds.has(domainId));
  return {
    id,
    name: String(source.name || '').trim() || (kind === 'core' ? 'Core' : `Service_${index + 1}`),
    kind,
    url: String(source.url || '').trim() || CORE_SERVICE_DEFAULT_URL,
    domains: domainIds,
    deployTargetId: String(source.deployTargetId || '').trim(),
    x: Number.isFinite(source.x) ? source.x : 80 + (index % 3) * 320,
    y: Number.isFinite(source.y) ? source.y : 80 + Math.floor(index / 3) * 240,
    width: Number.isFinite(source.width)
      ? Math.max(ARCHITECTURE_SERVICE_MIN_WIDTH, source.width)
      : ARCHITECTURE_SERVICE_DEFAULT_WIDTH,
    height: Number.isFinite(source.height)
      ? Math.max(ARCHITECTURE_SERVICE_MIN_HEIGHT, source.height)
      : ARCHITECTURE_SERVICE_DEFAULT_HEIGHT
  };
}

export function normalizeArchitectureLink(entry, index, knownServiceIds) {
  const source = entry || {};
  const from = String(source.from || '').trim();
  const to = String(source.to || '').trim();
  if (knownServiceIds && (!knownServiceIds.has(from) || !knownServiceIds.has(to))) {
    return null;
  }
  const protocol = ARCHITECTURE_LINK_PROTOCOLS.includes(source.protocol) ? source.protocol : 'rest';
  return {
    id: String(source.id || '').trim() || fallbackId('arch-link', index),
    from,
    to,
    protocol,
    contractRef: String(source.contractRef || '').trim()
  };
}

/**
 * Normalise architecture. Absent or empty services become the monolith
 * preset (Cana load of pre-JUM-815 payloads).
 */
export function normalizeArchitectureInput(architecture, domains) {
  const list = Array.isArray(domains) ? domains : [];
  const knownDomainIds = new Set(list.map((domain) => domain.id));
  const source = architecture && typeof architecture === 'object' ? architecture : {};
  const rawServices = Array.isArray(source.services) ? source.services : [];
  if (!rawServices.length) {
    return buildMonolithArchitecture(list);
  }
  const services = rawServices.map((entry, index) => normalizeArchitectureService(entry, index, knownDomainIds));
  const assigned = new Set(services.flatMap((service) => service.domains));
  const core = services.find((service) => service.kind === 'core') || services[0];
  list.forEach((domain) => {
    if (!assigned.has(domain.id) && core) {
      core.domains.push(domain.id);
      assigned.add(domain.id);
    }
  });
  const knownServiceIds = new Set(services.map((service) => service.id));
  const links = (Array.isArray(source.links) ? source.links : [])
    .map((entry, index) => normalizeArchitectureLink(entry, index, knownServiceIds))
    .filter(Boolean);
  return { services, links };
}

export function serviceForDomain(architecture, domainId) {
  return (architecture?.services || []).find((service) => service.domains.includes(domainId)) || null;
}

export function protocolInterfaceType(protocol) {
  return PROTOCOL_TO_INTERFACE[protocol] || protocol;
}

export function assignDomainToService(architecture, domainId, serviceId) {
  const next = {
    services: (architecture?.services || []).map((service) => ({
      ...service,
      domains: service.domains.filter((id) => id !== domainId)
    })),
    links: Array.isArray(architecture?.links) ? architecture.links.slice() : []
  };
  const target = next.services.find((service) => service.id === serviceId);
  if (target && !target.domains.includes(domainId)) target.domains.push(domainId);
  return next;
}

export function addArchitectureService(architecture, service, domains) {
  const current = normalizeArchitectureInput(architecture, domains);
  const nextService = normalizeArchitectureService(
    service,
    current.services.length,
    new Set((domains || []).map((domain) => domain.id))
  );
  return {
    services: [...current.services, nextService],
    links: current.links
  };
}

export function removeArchitectureService(architecture, serviceId, domains) {
  const current = normalizeArchitectureInput(architecture, domains);
  const remaining = current.services.filter((service) => service.id !== serviceId);
  if (!remaining.length) return buildMonolithArchitecture(domains);
  const core = remaining.find((service) => service.kind === 'core') || remaining[0];
  const dropped = current.services.find((service) => service.id === serviceId);
  (dropped?.domains || []).forEach((domainId) => {
    if (!core.domains.includes(domainId)) core.domains.push(domainId);
  });
  return {
    services: remaining,
    links: current.links.filter((link) => link.from !== serviceId && link.to !== serviceId)
  };
}

export function addArchitectureLink(architecture, link, domains) {
  const current = normalizeArchitectureInput(architecture, domains);
  const knownServiceIds = new Set(current.services.map((service) => service.id));
  const nextLink = normalizeArchitectureLink(link, current.links.length, knownServiceIds);
  if (!nextLink) return current;
  return { services: current.services, links: [...current.links, nextLink] };
}

export function buildArchitectureFromOas(parsed, domains) {
  const list = Array.isArray(domains) ? domains : [];
  const servicesInput = Array.isArray(parsed?.['x-services']) ? parsed['x-services'] : [];
  const servers = Array.isArray(parsed?.servers) ? parsed.servers : [];
  const urlByService = new Map();
  servers.forEach((server) => {
    const serviceId = String(server?.['x-service-id'] || '').trim();
    if (serviceId && server.url) urlByService.set(serviceId, String(server.url));
  });
  const domainByName = new Map(list.map((domain) => [normalizedName(domain.name), domain]));
  const schemaDomainNames = new Map();
  const schemas = parsed?.components?.schemas && typeof parsed.components.schemas === 'object'
    ? parsed.components.schemas
    : {};
  Object.values(schemas).forEach((schema) => {
    const serviceId = String(schema?.['x-service'] || '').trim();
    const domainName = String(schema?.['x-domain'] || '').trim();
    if (!serviceId || !domainName) return;
    if (!schemaDomainNames.has(serviceId)) schemaDomainNames.set(serviceId, new Set());
    schemaDomainNames.get(serviceId).add(normalizedName(domainName));
  });
  const services = servicesInput.map((entry, index) => {
    const id = String(entry?.id || '').trim() || fallbackId('service', index);
    const ownedNames = schemaDomainNames.get(id) || new Set();
    const domainIds = list
      .filter((domain) => ownedNames.has(normalizedName(domain.name)))
      .map((domain) => domain.id);
    return normalizeArchitectureService({
      ...entry,
      id,
      url: urlByService.get(id) || entry?.url,
      domains: domainIds.length ? domainIds : (entry?.domains || [])
    }, index, new Set(list.map((domain) => domain.id)));
  });
  if (!services.length) {
    return normalizeArchitectureInput(null, list);
  }
  const linksInput = Array.isArray(parsed?.['x-architecture-links']) ? parsed['x-architecture-links'] : [];
  return normalizeArchitectureInput({ services, links: linksInput }, list);
}
