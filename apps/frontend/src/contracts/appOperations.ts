import openApi from './openapi.json';

/**
 * Application-level operation map (JUM-780). The shell (auth, profile, nav)
 * used to hardcode operationIds such as `getAll` and `getOneById` in five
 * files; a generated app for another domain renamed them in the spec and
 * the UI silently hid everything because `can()` fails closed on unknown
 * ids. The map is one object, overridable, and validated against the
 * bundled OAS at boot: a missing operation is a visible error, not a blank
 * screen.
 */
export interface AppOperations {
  auth: { login: string; register: string; logout: string };
  profile: { get: string; update: string; updatePassword: string };
}

export const DEFAULT_APP_OPERATIONS: AppOperations = {
  auth: { login: 'login', register: 'register', logout: 'logout' },
  profile: { get: 'getOneById', update: 'update', updatePassword: 'updatePassword' }
};

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

const declaredOperationIds = (): Set<string> => {
  const ids = new Set<string>();
  type Paths = Record<string, Record<string, { operationId?: string }>>;
  const paths = (openApi as { paths?: Paths }).paths ?? {};
  for (const pathItem of Object.values(paths)) {
    for (const operation of Object.values(pathItem)) {
      if (operation && typeof operation === 'object' && operation.operationId) ids.add(operation.operationId);
    }
  }
  return ids;
};

/**
 * Returns the ids each missing from the contract, keyed by their dotted path
 * (`profile.get`). Empty when the map is fully declared.
 */
export const validateAppOperations = (
  operations: AppOperations,
  declared: Set<string> = declaredOperationIds()
): string[] => {
  const missing: string[] = [];
  for (const [group, entries] of Object.entries(operations)) {
    for (const [key, id] of Object.entries(entries as Record<string, string>)) {
      if (!declared.has(id)) missing.push(`${group}.${key} → "${id}"`);
    }
  }
  return missing;
};

export const resolveAppOperations = (overrides?: DeepPartial<AppOperations>): AppOperations => ({
  auth: { ...DEFAULT_APP_OPERATIONS.auth, ...(overrides?.auth ?? {}) },
  profile: { ...DEFAULT_APP_OPERATIONS.profile, ...(overrides?.profile ?? {}) }
});

let active: AppOperations = resolveAppOperations();

/** Installs the map for the app; throws listing every id the OAS does not declare. */
export const configureAppOperations = (overrides?: DeepPartial<AppOperations>): AppOperations => {
  const next = resolveAppOperations(overrides);
  const missing = validateAppOperations(next);
  if (missing.length > 0) {
    throw new Error(
      `appOperations: the bundled OAS declares no operation for ${missing.join(', ')}. `
        + 'Regenerate src/contracts/openapi.json or override the ids in configureAppOperations().'
    );
  }
  active = next;
  return active;
};

export const appOperations = (): AppOperations => active;
