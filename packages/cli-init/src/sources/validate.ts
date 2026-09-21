import {
  ALLOWED_HTTP,
  ALLOWED_REALTIME,
  type GenerationPlan,
  type PlanService,
  SourceResolutionError
} from './types';
import { SOURCE_MESSAGES } from './messages';

function serviceIdForDomain(services: PlanService[], domainId: string): string | undefined {
  const owner = services.find((service) => service.domains.includes(domainId));
  return owner?.id;
}

function entityServiceMap(plan: GenerationPlan): Map<string, string> {
  const map = new Map<string, string>();
  for (const domain of plan.domains) {
    const serviceId = serviceIdForDomain(plan.services, domain.id) || plan.services[0]?.id;
    for (const entity of domain.entities) {
      if (serviceId) map.set(entity.name, serviceId);
    }
  }
  return map;
}

/**
 * Fail closed with named messages (exit code 1 via SourceResolutionError).
 */
export function validateGenerationPlan(plan: GenerationPlan): void {
  const hasCore = plan.services.some((service) => service.kind === 'core');
  if (!hasCore) {
    throw new SourceResolutionError(SOURCE_MESSAGES.NO_CORE_SERVICE);
  }

  const seenEntities = new Map<string, string>();
  for (const domain of plan.domains) {
    for (const entity of domain.entities) {
      if (!entity.primaryKey || !String(entity.primaryKey).trim()) {
        throw new SourceResolutionError(
          SOURCE_MESSAGES.ENTITY_WITHOUT_PRIMARY_KEY(entity.name, domain.id)
        );
      }
      const priorDomain = seenEntities.get(entity.name);
      if (priorDomain && priorDomain !== domain.id) {
        throw new SourceResolutionError(
          SOURCE_MESSAGES.DUPLICATE_ENTITY_NAMES(entity.name, priorDomain, domain.id)
        );
      }
      seenEntities.set(entity.name, domain.id);
    }
  }

  for (const service of plan.services) {
    if (!ALLOWED_HTTP.includes(service.interfaces.http)) {
      throw new SourceResolutionError(
        SOURCE_MESSAGES.UNSUPPORTED_INTERFACE(service.id, 'http', String(service.interfaces.http))
      );
    }
    if (!ALLOWED_REALTIME.includes(service.interfaces.realtime)) {
      throw new SourceResolutionError(
        SOURCE_MESSAGES.UNSUPPORTED_INTERFACE(
          service.id,
          'realtime',
          String(service.interfaces.realtime)
        )
      );
    }
  }

  if (plan.mode === 'monolith') {
    const entityServices = entityServiceMap(plan);
    for (const domain of plan.domains) {
      for (const entity of domain.entities) {
        const fromService = entityServices.get(entity.name);
        for (const relation of entity.relations) {
          const toService = entityServices.get(relation.entity);
          if (fromService && toService && fromService !== toService) {
            throw new SourceResolutionError(
              SOURCE_MESSAGES.RELATION_CROSSING_BOUNDARY(
                relation.name || `${entity.name}->${relation.entity}`,
                fromService,
                toService
              )
            );
          }
        }
      }
    }
  }
}
