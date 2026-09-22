import fs from 'node:fs';
import path from 'node:path';
import type { GenerationPlan, PlanDomain, PlanService } from '../sources/types';
import { loadDesignerCore } from '../sources/planBuilder';

const USERS_DOMAIN_TOKENS = new Set(['users', 'user']);

export function isUsersDomain(domain: PlanDomain): boolean {
  const id = String(domain.id || '').toLowerCase();
  const name = String(domain.name || '').toLowerCase();
  return USERS_DOMAIN_TOKENS.has(id) || USERS_DOMAIN_TOKENS.has(name);
}

/**
 * Domains owned by a service that should be codegen'd (Users stays from the
 * template seed — never overwritten by hexagonal boilerplate).
 */
export function domainsForService(
  plan: GenerationPlan,
  service: PlanService
): PlanDomain[] {
  const owned = new Set(service.domains.map((id) => String(id)));
  return plan.domains.filter((domain) => {
    if (isUsersDomain(domain)) return false;
    if (owned.size === 0) return service.kind === 'core';
    return owned.has(domain.id) || (domain.name ? owned.has(domain.name) : false);
  });
}

type DesignerEntity = {
  id: string;
  name: string;
  fields: Array<{ name: string; pk?: boolean; type?: string }>;
};

type DesignerDomain = {
  id: string;
  name: string;
  entities: DesignerEntity[];
};

/**
 * Convert plan domains into the designer-state shape `buildHexagonalBundle`
 * expects.
 */
export function planDomainsToDesignerState(domains: PlanDomain[]): {
  domains: DesignerDomain[];
} {
  return {
    domains: domains.map((domain) => {
      const name = domain.name || domain.id;
      return {
        id: domain.id,
        name,
        entities: domain.entities.map((entity) => {
          const properties = (entity.schema && typeof entity.schema === 'object'
            && (entity.schema as { properties?: Record<string, unknown> }).properties)
            || {};
          const fieldNames = Object.keys(properties);
          const fields = (fieldNames.length
            ? fieldNames
            : [entity.primaryKey || 'id']
          ).map((fieldName) => ({
            name: fieldName,
            pk: fieldName === entity.primaryKey,
            type: 'string'
          }));
          return {
            id: entity.name,
            name: entity.name,
            fields
          };
        })
      };
    })
  };
}

function toDomainToken(value: string): string {
  const token = String(value || '')
    .trim()
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
  return token || 'Domain';
}

export type InjectedDomainResult = {
  moduleNames: string[];
  filesWritten: string[];
};

type HexBundle = {
  modules: Array<{
    module: string;
    path: string;
    files: Record<string, { path: string; content: string } | undefined>;
    entities: Array<{
      entity: string;
      files: Record<string, { path: string; content: string }>;
    }>;
  }>;
};

function flattenBundleLocally(bundle: HexBundle): Array<{ path: string; content: string }> {
  const files: Array<{ path: string; content: string }> = [];
  for (const module of bundle.modules) {
    for (const role of Object.keys(module.files)) {
      const file = module.files[role];
      if (file) files.push(file);
    }
    for (const entity of module.entities) {
      for (const role of Object.keys(entity.files)) {
        files.push(entity.files[role]);
      }
    }
  }
  return files;
}

/**
 * Composition root that always registers Users auth and any generated domains.
 */
export function renderCompositionRoot(generatedModuleTokens: string[]): string {
  const unique = [...new Set(generatedModuleTokens)].filter(Boolean);
  const imports = unique.map(
    (token) => `import { compose${token}Services } from './${token}/composition/compose${token}Services';`
  );
  const registerLines = unique.map(
    (token) => `  ${token}: compose${token}Services()`
  );

  const registryBody = [
    '  ...(users ? { Users: users } : {}),',
    ...registerLines.map((line, index) => (
      index < registerLines.length - 1 ? `${line},` : line
    ))
  ];

  return [
    '/**',
    ' * Generated composition root (JUM-847).',
    ' * Core always includes Users + auth from the seed; designer domains are',
    ' * registered via their hexagonal compose<Domain>Services exports.',
    ' */',
    'import { composeUsersAuthServices } from \'./Users/composition/composeUsersAuthServices\';',
    ...imports,
    '',
    'export type GeneratedDomainRegistry = Record<string, unknown>;',
    '',
    'export function registerGeneratedDomains(',
    '  usersDeps?: Parameters<typeof composeUsersAuthServices>[0]',
    '): GeneratedDomainRegistry {',
    '  const users = usersDeps',
    '    ? composeUsersAuthServices(usersDeps)',
    '    : undefined;',
    '  return {',
    ...registryBody,
    '  };',
    '}',
    '',
    `export const GENERATED_DOMAIN_MODULES = ${JSON.stringify(unique)} as const;`,
    ''
  ].join('\n');
}

/**
 * Generate hexagonal modules for non-Users domains and write a composition
 * root that registers each `compose<Domain>Services` export.
 */
export async function injectDesignerDomains(options: {
  serviceRoot: string;
  plan: GenerationPlan;
  service: PlanService;
}): Promise<InjectedDomainResult> {
  const { serviceRoot, plan, service } = options;
  const targetDomains = domainsForService(plan, service);
  const filesWritten: string[] = [];
  const moduleNames: string[] = [];

  if (targetDomains.length === 0) {
    const compositionPath = path.join(serviceRoot, 'src', 'modules', 'compositionRoot.ts');
    const content = renderCompositionRoot([]);
    fs.mkdirSync(path.dirname(compositionPath), { recursive: true });
    fs.writeFileSync(compositionPath, content, 'utf8');
    filesWritten.push('src/modules/compositionRoot.ts');
    return { moduleNames, filesWritten };
  }

  const designerCore = await loadDesignerCore();
  const state = planDomainsToDesignerState(targetDomains);
  const oasDocument = plan.contracts.oasPerService[service.id]
    || Object.values(plan.contracts.oasPerService)[0]
    || {};

  const bundle = designerCore.buildHexagonalBundle(state, { oasDocument }) as HexBundle;
  const flat = typeof designerCore.flattenBundleFiles === 'function'
    ? designerCore.flattenBundleFiles(bundle)
    : flattenBundleLocally(bundle);

  for (const file of flat) {
    const absolute = path.join(serviceRoot, file.path);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, file.content, 'utf8');
    filesWritten.push(file.path.replace(/\\/g, '/'));
  }

  for (const module of bundle.modules) {
    moduleNames.push(toDomainToken(module.module));
  }

  const compositionPath = path.join(serviceRoot, 'src', 'modules', 'compositionRoot.ts');
  fs.writeFileSync(compositionPath, renderCompositionRoot(moduleNames), 'utf8');
  filesWritten.push('src/modules/compositionRoot.ts');

  return { moduleNames, filesWritten };
}
