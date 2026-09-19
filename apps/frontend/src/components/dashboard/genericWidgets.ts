import { fieldDescriptors } from '@/contracts/formSchema';
import { fieldLabel } from '@/contracts/labels';
import { metricsSpecForListOperation } from '@/contracts/metricsSchema';
import type { ModuleManifest } from '@/modules/manifest';
import { localized } from '@/i18n';

import MetricWidget from './MetricWidget.vue';
import type { DashboardWidget } from './types';

const belongsToInverse = (
  targetEntity: string,
  ownerEntity: string
): string | undefined => (
  fieldDescriptors(targetEntity).find((descriptor) => (
    descriptor.relation?.kind === 'belongsTo' && descriptor.relation.entity === ownerEntity
  ))?.name
);

export const genericWidgetsForModule = (mod: ModuleManifest | undefined): DashboardWidget[] => {
  if (!mod) return [];
  const widgets: DashboardWidget[] = [];
  const seen = new Set<string>();
  const push = (widget: DashboardWidget): void => {
    if (seen.has(widget.id)) return;
    seen.add(widget.id);
    widgets.push(widget);
  };

  for (const entity of mod.entities) {
    const spec = metricsSpecForListOperation(entity.config.operations.list);
    if (spec) {
      const entityTitle = localized(entity.title);
      push({
        id: `generic:${entity.id}:count`,
        title: { en: entityTitle, 'pt-BR': entityTitle },
        size: 'sm',
        component: MetricWidget,
        query: {
          listOperationId: entity.config.operations.list,
          metricsOperationId: spec.operationId,
          schemaName: entity.config.entity,
          metric: 'count',
          showPending: true,
          metricKey: entity.id
        }
      });
      for (const field of spec.capabilities.groupable) {
        const descriptor = fieldDescriptors(entity.config.entity)
          .find((item) => item.name === field);
        const label = descriptor ? fieldLabel(descriptor) : field;
        push({
          id: `generic:${entity.id}:groupBy:${field}`,
          title: {
            en: `${entityTitle} by ${label}`,
            'pt-BR': `${entityTitle} por ${label}`
          },
          size: 'md',
          component: MetricWidget,
          query: {
            listOperationId: entity.config.operations.list,
            metricsOperationId: spec.operationId,
            schemaName: entity.config.entity,
            metric: 'groupBy',
            field
          }
        });
      }
      for (const field of spec.capabilities.series) {
        const descriptor = fieldDescriptors(entity.config.entity)
          .find((item) => item.name === field);
        const label = descriptor ? fieldLabel(descriptor) : field;
        push({
          id: `generic:${entity.id}:series:${field}`,
          title: {
            en: `${entityTitle} ${label} (day)`,
            'pt-BR': `${entityTitle} ${label} (dia)`
          },
          size: 'lg',
          component: MetricWidget,
          query: {
            listOperationId: entity.config.operations.list,
            metricsOperationId: spec.operationId,
            schemaName: entity.config.entity,
            metric: 'series',
            field,
            interval: 'day'
          }
        });
      }
      for (const descriptor of fieldDescriptors(entity.config.entity)) {
        const { relation } = descriptor;
        if (relation?.kind === 'hasMany') {
          const inverse = belongsToInverse(relation.entity, entity.config.entity);
          const child = inverse
            ? mod.entities.find((item) => item.config.entity === relation.entity)
            : undefined;
          const childSpec = child
            ? metricsSpecForListOperation(child.config.operations.list)
            : undefined;
          if (inverse && child && childSpec?.capabilities.groupable.includes(inverse)) {
            const relationLabel = fieldLabel(descriptor);
            push({
              id: `generic:${entity.id}:fan-out:${descriptor.name}`,
              title: {
                en: `${relationLabel} per ${entityTitle}`,
                'pt-BR': `${relationLabel} por ${entityTitle}`
              },
              size: 'md',
              component: MetricWidget,
              query: {
                listOperationId: child.config.operations.list,
                metricsOperationId: childSpec.operationId,
                schemaName: child.config.entity,
                metric: 'groupBy',
                field: inverse
              }
            });
          }
        }
      }
    }
  }
  return widgets;
};
