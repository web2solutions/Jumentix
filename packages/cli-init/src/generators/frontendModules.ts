import fs from 'node:fs';
import path from 'node:path';
import type { PlanDomain, PlanEntity } from '../sources/types';
import {
  entityTitleFromOas,
  fallbackSearchFields,
  resolveEntityOperations,
  resolveRequestSchemas,
  searchableFieldsForOperation,
  type LocalizedTitle
} from './frontendOas';

type JsonObject = Record<string, unknown>;

/** Kebab/camel-safe module or entity folder slug. */
export function slugifyIdentifier(raw: string, fallback = 'module'): string {
  const slug = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || fallback;
}

/** camelCase identifier from entity name (User → user, Organization → organization). */
export function camelCaseName(raw: string): string {
  const cleaned = String(raw || '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (cleaned.length === 0) return 'entity';
  return cleaned
    .map((part, index) => {
      const lower = part.toLowerCase();
      if (index === 0) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join('');
}

/** PascalCase for view/component names. */
export function pascalCaseName(raw: string): string {
  const camel = camelCaseName(raw);
  return camel.charAt(0).toUpperCase() + camel.slice(1);
}

export type GeneratedEntityConfig = {
  entityId: string;
  entityName: string;
  featureDir: string;
  configExport: string;
  configFile: string;
  viewFile: string;
  viewExport: string;
  title: LocalizedTitle;
  operations: { list: string; create: string; update: string; delete: string };
  searchFields: string[];
  schemas: { create: string; update: string };
};

export type GeneratedModuleResult = {
  moduleId: string;
  moduleFile: string;
  title: LocalizedTitle;
  icon: string;
  entities: GeneratedEntityConfig[];
};

function iconForModule(moduleId: string): string {
  if (moduleId === 'users') return 'cil-people';
  if (moduleId === 'organizations') return 'cil-building';
  return 'cil-layers';
}

function domainModuleId(domain: PlanDomain): string {
  return slugifyIdentifier(domain.name || domain.id, 'domain');
}

function domainTitle(domain: PlanDomain): LocalizedTitle {
  const label = String(domain.name || domain.id || 'Domain');
  return { en: label, 'pt-BR': label };
}

function renderCrudConfigSource(config: GeneratedEntityConfig): string {
  const search = JSON.stringify(config.searchFields);
  const title = JSON.stringify(config.title);
  return `import type { XCrudEntityConfig } from '@/components/x-crud/xCrudTypes';

/**
 * Generated X-CRUD config for ${config.entityName} (JUM-848).
 */
export const ${config.configExport}: XCrudEntityConfig = {
  entity: '${config.entityName}',
  title: ${title},
  schemas: { create: '${config.schemas.create}', update: '${config.schemas.update}' },
  operations: {
    list: '${config.operations.list}',
    create: '${config.operations.create}',
    update: '${config.operations.update}',
    delete: '${config.operations.delete}'
  },
  searchFields: ${search},
  pagination: 'pager',
  inlineEdit: true
};
`;
}

function renderEntityViewSource(config: GeneratedEntityConfig): string {
  const titleKey = `nav.${config.entityId}`;
  return `<script setup lang="ts">
import { useI18n } from '@/i18n';
import XCrud from '@/components/x-crud/XCrud.vue';

import { ${config.configExport} } from './${config.configFile.replace(/\.ts$/, '')}';

const { t } = useI18n();
</script>

<template>
  <div>
    <h3 class="mb-3">{{ t('${titleKey}') }}</h3>
    <XCrud :config="${config.configExport}" />
  </div>
</template>
`;
}

function renderDomainWidgetsSource(moduleId: string, firstListOp: string | undefined): string {
  const exportName = `${camelCaseName(moduleId)}DomainWidgets`;
  if (!firstListOp) {
    return `import type { DashboardWidget } from '@/components/dashboard/types';

/** Generated dashboard widgets for module "${moduleId}" (JUM-848). */
export const ${exportName} = (): DashboardWidget[] => [];
`;
  }
  return `import MetricWidget from '@/components/dashboard/MetricWidget.vue';
import type { DashboardWidget } from '@/components/dashboard/types';
import { metricsSpecForListOperation } from '@/contracts/metricsSchema';

const listOperationId = '${firstListOp}';
const metrics = metricsSpecForListOperation(listOperationId);

/** Generated dashboard widgets for module "${moduleId}" (JUM-848). */
export const ${exportName} = (): DashboardWidget[] => {
  if (!metrics) return [];
  return [
    {
      id: '${moduleId}:count',
      title: { en: 'Total', 'pt-BR': 'Total' },
      size: 'sm',
      component: MetricWidget,
      query: {
        listOperationId,
        metricsOperationId: metrics.operationId,
        schemaName: '${moduleId}',
        metric: 'count'
      }
    }
  ];
};
`;
}

function renderModuleSource(
  moduleId: string,
  title: LocalizedTitle,
  icon: string,
  entities: GeneratedEntityConfig[],
  widgetsExport: string
): string {
  const entityImports = entities.map((entity) => (
    `import { ${entity.configExport} } from '@/features/${entity.featureDir}/${entity.configFile.replace(/\.ts$/, '')}';`
  )).join('\n');

  const entityEntries = entities.map((entity) => `    {
      id: '${entity.entityId}',
      title: ${JSON.stringify(entity.title)},
      config: ${entity.configExport},
      load: () => import('@/features/${entity.featureDir}/${entity.viewExport}.vue')
    }`).join(',\n');

  const widgetsImport = `import { ${widgetsExport} } from '@/features/dashboard/${widgetsExport}';`;

  return `${widgetsImport}
${entityImports}
import type { ModuleManifest } from '@/modules/manifest';

export const ${camelCaseName(moduleId)}Module: ModuleManifest = {
  id: '${moduleId}',
  title: ${JSON.stringify(title)},
  icon: '${icon}',
  entities: [
${entityEntries}
  ],
  dashboard: {
    load: () => import('@/features/dashboard/DashboardView.vue'),
    widgets: ${widgetsExport}()
  }
};
`;
}

function buildEntityConfig(
  entity: PlanEntity,
  oas: JsonObject
): GeneratedEntityConfig {
  const entityName = entity.name;
  const entityId = slugifyIdentifier(entityName, 'entity');
  const featureDir = entityId;
  const camel = camelCaseName(entityName);
  const pascal = pascalCaseName(entityName);
  const operations = resolveEntityOperations(oas, entityName);
  const schemas = resolveRequestSchemas(oas, entityName);
  const fromCaps = searchableFieldsForOperation(oas, operations.list);
  const searchFields = fromCaps.length > 0
    ? fromCaps
    : fallbackSearchFields(entity.schema);
  const title = entityTitleFromOas(oas, entityName);

  return {
    entityId,
    entityName,
    featureDir,
    configExport: `${camel}CrudConfig`,
    configFile: `${camel}CrudConfig.ts`,
    viewFile: `${pascal}View.vue`,
    viewExport: `${pascal}View`,
    title,
    operations,
    searchFields: searchFields.length > 0 ? searchFields : ['id'],
    schemas
  };
}

/**
 * Write one frontend module (entity configs, views, dashboard widgets, manifest)
 * under the generated frontend root.
 */
export function writeDomainModule(
  frontendRoot: string,
  domain: PlanDomain,
  oas: JsonObject
): GeneratedModuleResult {
  const moduleId = domainModuleId(domain);
  const title = domainTitle(domain);
  const icon = iconForModule(moduleId);
  const entities = domain.entities.map((entity) => buildEntityConfig(entity, oas));

  for (const entity of entities) {
    const featureRoot = path.join(frontendRoot, 'src', 'features', entity.featureDir);
    fs.mkdirSync(featureRoot, { recursive: true });
    fs.writeFileSync(
      path.join(featureRoot, entity.configFile),
      renderCrudConfigSource(entity),
      'utf8'
    );
    fs.writeFileSync(
      path.join(featureRoot, entity.viewFile),
      renderEntityViewSource(entity),
      'utf8'
    );
  }

  const widgetsExport = `${camelCaseName(moduleId)}DomainWidgets`;
  const widgetsPath = path.join(
    frontendRoot,
    'src',
    'features',
    'dashboard',
    `${widgetsExport}.ts`
  );
  fs.mkdirSync(path.dirname(widgetsPath), { recursive: true });
  fs.writeFileSync(
    widgetsPath,
    renderDomainWidgetsSource(moduleId, entities[0]?.operations.list),
    'utf8'
  );

  const moduleFile = path.join(frontendRoot, 'src', 'modules', `${moduleId}.ts`);
  fs.mkdirSync(path.dirname(moduleFile), { recursive: true });
  fs.writeFileSync(
    moduleFile,
    renderModuleSource(moduleId, title, icon, entities, widgetsExport),
    'utf8'
  );

  return {
    moduleId,
    moduleFile,
    title,
    icon,
    entities
  };
}

/** Rewrite `src/modules/index.ts` to register generated modules. */
export function writeModulesIndex(
  frontendRoot: string,
  modules: GeneratedModuleResult[]
): void {
  const imports = modules.map((mod) => {
    const exportName = `${camelCaseName(mod.moduleId)}Module`;
    return `import { ${exportName} } from '@/modules/${mod.moduleId}';`;
  }).join('\n');

  const registrations = modules.map((mod) => {
    const exportName = `${camelCaseName(mod.moduleId)}Module`;
    return `if (!findModule(${exportName}.id)) {
  registerModule(${exportName});
}`;
  }).join('\n');

  const source = `import { configureModules, findModule, registerModule } from '@/modules/manifest';
${imports}

${registrations}
configureModules();
`;
  fs.writeFileSync(path.join(frontendRoot, 'src', 'modules', 'index.ts'), source, 'utf8');
}

/**
 * Append `module.*` / `nav.*` titles into i18n messages for generated modules.
 */
export function patchI18nTitles(
  frontendRoot: string,
  modules: GeneratedModuleResult[]
): void {
  const messagesPath = path.join(frontendRoot, 'src', 'i18n', 'messages.ts');
  if (!fs.existsSync(messagesPath)) return;

  let source = fs.readFileSync(messagesPath, 'utf8');
  const enLines: string[] = [];
  const ptLines: string[] = [];

  for (const mod of modules) {
    enLines.push(`  'module.${mod.moduleId}': ${JSON.stringify(mod.title.en)},`);
    ptLines.push(`  'module.${mod.moduleId}': ${JSON.stringify(mod.title['pt-BR'])},`);
    for (const entity of mod.entities) {
      enLines.push(`  'nav.${entity.entityId}': ${JSON.stringify(entity.title.en)},`);
      ptLines.push(`  'nav.${entity.entityId}': ${JSON.stringify(entity.title['pt-BR'])},`);
    }
  }

  const marker = '  // --- generated module titles (JUM-848) ---';
  if (source.includes(marker)) {
    // already patched in a prior run — leave as-is
    return;
  }

  const inject = (localeBlock: 'en' | 'ptBR', lines: string[]): void => {
    const needle = localeBlock === 'en'
      ? 'const en: Messages = {'
      : 'const ptBR: Messages = {';
    const idx = source.indexOf(needle);
    if (idx < 0) return;
    const insertAt = source.indexOf('\n', idx) + 1;
    const block = `${marker}\n${lines.join('\n')}\n`;
    source = `${source.slice(0, insertAt)}${block}${source.slice(insertAt)}`;
  };

  inject('en', enLines);
  inject('ptBR', ptLines);
  fs.writeFileSync(messagesPath, source, 'utf8');
}

/**
 * Point the default home redirect at the first generated module.
 */
export function patchRouterHome(
  frontendRoot: string,
  firstModuleId: string | undefined
): void {
  if (!firstModuleId) return;
  const routerPath = path.join(frontendRoot, 'src', 'router', 'index.ts');
  if (!fs.existsSync(routerPath)) return;
  let source = fs.readFileSync(routerPath, 'utf8');
  source = source.replace(
    /redirect:\s*'\/m\/[^']+'/g,
    `redirect: '/m/${firstModuleId}/dashboard'`
  );
  fs.writeFileSync(routerPath, source, 'utf8');
}
