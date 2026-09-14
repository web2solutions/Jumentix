import type { Component } from 'vue';

import type { XCrudEntityConfig, XCrudText } from '@/components/x-crud/xCrudTypes';
import openApi from '@/contracts/openapi.json';
import { can, requiredScopes } from '@/contracts/rbac';

export interface ModuleEntity {
  id: string;
  title: XCrudText;
  config: XCrudEntityConfig;
  load: () => Promise<{ default: Component }>;
}

export interface ModuleDashboard {
  load: () => Promise<{ default: Component }>;
}

export interface ModuleManifest {
  id: string;
  title: XCrudText;
  icon: string;
  entities: ModuleEntity[];
  dashboard?: ModuleDashboard;
  toolbarWidgets?: string[];
}

const modules: ModuleManifest[] = [];

type Paths = Record<string, Record<string, { operationId?: string }>>;

export const declaredOperationIds = (
  spec: { paths?: Paths } = openApi as { paths?: Paths }
): Set<string> => {
  const ids = new Set<string>();
  for (const pathItem of Object.values(spec.paths ?? {})) {
    for (const operation of Object.values(pathItem)) {
      if (operation && typeof operation === 'object' && operation.operationId) {
        ids.add(operation.operationId);
      }
    }
  }
  return ids;
};

export const moduleOperationIds = (mod: ModuleManifest): string[] => (
  mod.entities.flatMap((entity) => Object.values(entity.config.operations))
);

export const moduleRequiredScopes = (mod: ModuleManifest): string[] => {
  const scopes = new Set<string>();
  for (const entity of mod.entities) {
    requiredScopes(entity.config.operations.list).forEach((scope) => scopes.add(scope));
  }
  return [...scopes];
};

export const canOpenModule = (mod: ModuleManifest, roles: string[] | undefined): boolean => (
  mod.entities.some((entity) => can(roles, entity.config.operations.list))
);

export const firstAllowedTab = (mod: ModuleManifest, roles: string[] | undefined): string => {
  const entity = mod.entities.find((item) => can(roles, item.config.operations.list));
  if (entity) return entity.id;
  return 'dashboard';
};

export const visibleEntityTabs = (
  mod: ModuleManifest,
  roles: string[] | undefined
): ModuleEntity[] => (
  mod.entities.filter((entity) => can(roles, entity.config.operations.list))
);

export const validateModules = (
  list: ModuleManifest[] = modules,
  declared: Set<string> = declaredOperationIds()
): string[] => {
  const missing: string[] = [];
  for (const mod of list) {
    for (const id of moduleOperationIds(mod)) {
      if (!declared.has(id)) missing.push(`${mod.id} → "${id}"`);
    }
  }
  return missing;
};

export const registerModule = (mod: ModuleManifest): void => {
  if (modules.some((item) => item.id === mod.id)) {
    throw new Error(`module "${mod.id}" is already registered`);
  }
  modules.push(mod);
};

export const registeredModules = (): readonly ModuleManifest[] => modules;

export const findModule = (id: string): ModuleManifest | undefined => (
  modules.find((mod) => mod.id === id)
);

/** Test hook: drop every registered module. */
export const resetModules = (): void => {
  modules.length = 0;
};

export const configureModules = (): void => {
  const missing = validateModules();
  if (missing.length > 0) {
    throw new Error(
      `modules: the bundled OAS declares no operation for ${missing.join(', ')}. `
        + 'Regenerate src/contracts/openapi.json or fix the module manifest.'
    );
  }
};
