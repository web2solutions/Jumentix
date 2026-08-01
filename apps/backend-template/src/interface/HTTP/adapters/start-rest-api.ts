import { resolveHTTPFramework } from '@src/interface/runtime/RuntimeEnvironment';

/**
 * Framework name to the module that starts it.
 *
 * Importing one of these *is* the side effect — each adapter module boots its
 * server at evaluation time — so the table holds thunks rather than modules.
 *
 * This was eleven near-identical `if` blocks. The mapping is data, and writing
 * it as data means adding an adapter is one row rather than one more branch a
 * reader has to compare against the ten above it.
 *
 * The thunks are the only unreachable part of this file: a unit test can assert
 * *which* one was selected — that is what the injected table is for — but never
 * call it. Hence `ignore next` here, rather than the `ignore file` this carried
 * before: the file-wide form also hid the loader beneath, so the selection
 * logic, the unknown-framework error and the default were invisible to coverage
 * for as long as the pragma covered everything.
 */
/* istanbul ignore next -- invoking a thunk boots a real server; see above */
export const REST_API_ADAPTERS: Readonly<Record<string, () => Promise<unknown>>> = {
  express: () => import('@src/interface/HTTP/adapters/express/express'),
  fastify: () => import('@src/interface/HTTP/adapters/fastify/fastify'),
  restify: () => import('@src/interface/HTTP/adapters/restify/restify'),
  'cloudflare-workers': () => import('@src/interface/HTTP/adapters/cloudflare-workers/cloudflare-workers'),
  'vercel-functions': () => import('@src/interface/HTTP/adapters/vercel-functions/vercel-functions'),
  loopback: () => import('@src/interface/HTTP/adapters/loopback/loopback'),
  'sails-js': () => import('@src/interface/HTTP/adapters/sails-js/sails-js'),
  feathers: () => import('@src/interface/HTTP/adapters/feathers/feathers'),
  'derby-js': () => import('@src/interface/HTTP/adapters/derby-js/derby-js'),
  'adonis-js': () => import('@src/interface/HTTP/adapters/adonis-js/adonis-js'),
  'total-js': () => import('@src/interface/HTTP/adapters/total-js/total-js')
};

/**
 * @param env Where `AAA_HTTP_FRAMEWORK` is read from.
 * @param adapters Injected so a test can observe which adapter was selected
 * without importing it — importing one starts a real HTTP server. That was
 * previously arranged by replacing the adapter module with `jest.doMock`, which
 * does not exist under Bun's runner (JUM-583).
 */
export async function startRestApiAdapter(
  env: NodeJS.ProcessEnv = process.env,
  adapters: Readonly<Record<string, () => Promise<unknown>>> = REST_API_ADAPTERS
): Promise<void> {
  const framework = resolveHTTPFramework(env);
  const load = adapters[framework];

  // `resolveHTTPFramework` already rejects names it does not know, so reaching
  // here means the two lists have drifted apart. The previous if-chain returned
  // silently in that case: no server started, and the caller told it succeeded.
  if (load === undefined) {
    throw new Error(
      `No adapter registered for AAA_HTTP_FRAMEWORK "${framework}". `
      + 'RuntimeEnvironment accepts it but REST_API_ADAPTERS has no entry.'
    );
  }

  await load();
}

// eslint-disable-next-line jest/require-hook
/* istanbul ignore if */
if (require.main === module) {
  startRestApiAdapter();
}
