export type RuntimeApiBag = Record<string, unknown>;

export type SnippetRunResult = {
  result: unknown;
  logs: string[];
};

type ConsoleMethod = (...args: unknown[]) => void;

function formatLogArg(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

async function importBlobModule(specifier: string): Promise<{
  default: () => Promise<unknown>;
}> {
  return import(/* webpackIgnore: true */ specifier) as Promise<{
    default: () => Promise<unknown>;
  }>;
}

/**
 * Run playground source as an ES module blob.
 * Injects `api` under `apiGlobalName` plus optional extras on globalThis.
 */
export async function runDocsSnippet(
  code: string,
  apiGlobalName: string,
  api: RuntimeApiBag,
  extras: Record<string, unknown> = {}
): Promise<SnippetRunResult> {
  const logs: string[] = [];
  const consoleRef = globalThis.console;
  const originalLog = consoleRef.log.bind(consoleRef) as ConsoleMethod;
  const originalInfo = consoleRef.info.bind(consoleRef) as ConsoleMethod;
  const originalWarn = consoleRef.warn.bind(consoleRef) as ConsoleMethod;

  const push = (...args: unknown[]) => {
    logs.push(args.map(formatLogArg).join(' '));
  };

  /* eslint-disable no-console -- intentional console capture for playground UI */
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
  /* eslint-enable no-console */

  const extraKeys = Object.keys(extras);
  const extraDecls = extraKeys
    .map((key) => `const ${key} = globalThis.__DOCS_PLAYGROUND_EXTRAS__[${JSON.stringify(key)}];`)
    .join('\n');

  const source = `
const ${apiGlobalName} = globalThis.__DOCS_PLAYGROUND_API__;
${extraDecls}
export default async function __docsPlaygroundMain() {
${code}
}
`;
  const blob = new Blob([source], { type: 'text/javascript' });
  const blobUrl = URL.createObjectURL(blob);
  const host = globalThis as typeof globalThis & {
    __DOCS_PLAYGROUND_API__?: RuntimeApiBag;
    __DOCS_PLAYGROUND_EXTRAS__?: Record<string, unknown>;
  };

  try {
    host.__DOCS_PLAYGROUND_API__ = api;
    host.__DOCS_PLAYGROUND_EXTRAS__ = extras;
    const mod = await importBlobModule(blobUrl);
    const result = await mod.default();
    return { result, logs };
  } finally {
    URL.revokeObjectURL(blobUrl);
    delete host.__DOCS_PLAYGROUND_API__;
    delete host.__DOCS_PLAYGROUND_EXTRAS__;
    /* eslint-disable no-console -- restore captured console methods */
    consoleRef.log = originalLog;
    consoleRef.info = originalInfo;
    consoleRef.warn = originalWarn;
    /* eslint-enable no-console */
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
