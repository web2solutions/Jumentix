export type CanaRuntimeApi = Record<string, unknown>;

export interface SnippetRunResult {
  result: unknown;
  logs: string[];
}

type ConsoleMethod = (...args: unknown[]) => void;

function formatLogArg(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/**
 * Load a blob: URL as an ES module without `new Function`.
 * webpackIgnore keeps the bundler from rewriting the dynamic specifier.
 */
async function importBlobModule(specifier: string): Promise<{
  default: () => Promise<unknown>;
}> {
  return import(/* webpackIgnore: true */ specifier) as Promise<{
    default: () => Promise<unknown>;
  }>;
}

/**
 * Run playground source as an ES module blob (no eval of user code).
 * Injects `cana` + `dbName` on globalThis only for the import window.
 */
export async function runCanaSnippet(
  code: string,
  cana: CanaRuntimeApi,
  dbName: string
): Promise<SnippetRunResult> {
  const logs: string[] = [];
  const consoleRef = globalThis.console;
  const originalLog = consoleRef.log.bind(consoleRef) as ConsoleMethod;
  const originalInfo = consoleRef.info.bind(consoleRef) as ConsoleMethod;
  const originalWarn = consoleRef.warn.bind(consoleRef) as ConsoleMethod;

  const push = (...args: unknown[]) => {
    logs.push(args.map(formatLogArg).join(' '));
  };

  // Capture playground console output into the result panel.

  consoleRef.log = (...args: unknown[]) => {
    push(...args);
    originalLog(...args);
  };
  consoleRef.info = (...args: unknown[]) => {
    push(...args);
    originalInfo(...args);
  };
  consoleRef.warn = (...args: unknown[]) => {
    push(...args);
    originalWarn(...args);
  };

  const source = `
const cana = globalThis.CANA_PLAYGROUND_API;
const dbName = globalThis.CANA_PLAYGROUND_DB;
export default async function __canaPlaygroundMain() {
${code}
}
`;
  const blob = new Blob([source], { type: 'text/javascript' });
  const blobUrl = window.URL.createObjectURL(blob);
  const host = globalThis as typeof globalThis & {
    CANA_PLAYGROUND_API?: CanaRuntimeApi;
    CANA_PLAYGROUND_DB?: string;
  };

  try {
    host.CANA_PLAYGROUND_API = cana;
    host.CANA_PLAYGROUND_DB = dbName;
    const mod = await importBlobModule(blobUrl);
    const result = await mod.default();
    return { result, logs };
  } finally {
    window.URL.revokeObjectURL(blobUrl);
    delete host.CANA_PLAYGROUND_API;
    delete host.CANA_PLAYGROUND_DB;

    consoleRef.log = originalLog;
    consoleRef.info = originalInfo;
    consoleRef.warn = originalWarn;
  }
}

export function deleteEphemeralDatabase(dbName: string): Promise<void> {
  if (typeof indexedDB === 'undefined') {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(dbName);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error('deleteDatabase failed'));
    request.onblocked = () => resolve();
  });
}
