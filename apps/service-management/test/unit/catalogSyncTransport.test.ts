/* eslint-disable @typescript-eslint/no-var-requires */
import path from 'node:path';

/**
 * The catalog HTTP port, asserted request by request (JUM-681/JUM-491).
 *
 * The sync-client suite next to this one drives publish, push, pull and
 * conflict resolution over a declared in-memory transport double, and the
 * integration suite pins that double's semantics against the real backend.
 * Neither of them executes `createCatalogHttpTransport` itself — the file that
 * turns those operations into URLs, headers, query strings and errors.
 *
 * That gap matters because every failure here is silent from above: a token
 * that never becomes an `Authorization` header, a `version` that never reaches
 * the query string, a 409 whose body is dropped so the conflict cannot be
 * reviewed. The double would keep passing through all of it.
 *
 * `fetch` is injected rather than intercepted (Requirement 135 §5/§7): the
 * **proxy here is `fetchDouble`**, standing in for the network, and it records
 * exactly what it was called with. Everything else — the transport, the URL
 * building, the error shape — is the production code.
 */
const repoRoot = path.resolve(__dirname, '../../../..');
const {
  createCatalogHttpTransport
} = require(path.join(repoRoot, 'apps', 'service-management', 'src', 'state', 'catalogSyncClient.js'));

type CallInit = { method: string; headers: Record<string, string>; body?: string };
type Call = { url: string; init: CallInit };

/** The network stand-in: records each request, answers a scripted response. */
function fetchDouble(responses: Array<{ ok?: boolean; status?: number; text: string }>) {
  const calls: Call[] = [];
  const queue = [...responses];

  const impl = async (url: string, init: Call['init']) => {
    calls.push({ url, init });
    const next = queue.shift() ?? { ok: true, status: 200, text: '' };
    return {
      ok: next.ok ?? true,
      status: next.status ?? 200,
      text: async () => next.text
    };
  };

  return { impl, calls };
}

const listPayload = JSON.stringify({ result: [{ id: 'cat-1', version: 3 }] });

describe('createCatalogHttpTransport (JUM-681)', () => {
  it('refuses to exist without a fetch implementation', () => {
    expect.hasAssertions();

    // Constructed with neither an injected `fetch` nor a global one. Failing at
    // construction is the point: a transport that defers the failure to the
    // first request fails inside a sync cycle, which reports as the catalog
    // being unreachable.
    const globalFetch = (globalThis as { fetch?: unknown }).fetch;
    delete (globalThis as { fetch?: unknown }).fetch;

    let raised: unknown = null;
    try {
      createCatalogHttpTransport({ baseUrl: 'http://localhost:3000' });
    } catch (error) {
      raised = error;
    }

    // Restored before the assertion so a failure here cannot leave the runtime
    // without `fetch` for every suite that follows.
    (globalThis as { fetch?: unknown }).fetch = globalFetch;

    expect((raised as Error).message)
      .toBe('createCatalogHttpTransport requires a fetch implementation.');
  });

  it('falls back to the runtime fetch when none is injected', async () => {
    expect.hasAssertions();

    const globalFetch = (globalThis as { fetch?: unknown }).fetch;
    const { impl, calls } = fetchDouble([{ text: listPayload }]);
    (globalThis as { fetch?: unknown }).fetch = impl;

    const transport = createCatalogHttpTransport({ baseUrl: 'http://localhost:3000' });
    await transport.listCatalogs();

    (globalThis as { fetch?: unknown }).fetch = globalFetch;

    expect(calls).toHaveLength(1);
  });

  it('fails closed when the platform catalog endpoint is not declared', async () => {
    expect.hasAssertions();

    const globalFetch = (globalThis as { fetch?: unknown }).fetch;
    const { impl } = fetchDouble([{ text: listPayload }]);
    (globalThis as { fetch?: unknown }).fetch = impl;

    const transport = createCatalogHttpTransport();
    await expect(transport.listCatalogs()).rejects.toThrow(
      'Service Management catalog API endpoint is not configured. Set JUMENTIX_SERVICE_MANAGEMENT_CATALOG_API_URL.'
    );

    (globalThis as { fetch?: unknown }).fetch = globalFetch;
  });

  it('uses the injected fetch even when the runtime fetch is absent', async () => {
    expect.hasAssertions();

    const globalFetch = (globalThis as { fetch?: unknown }).fetch;
    delete (globalThis as { fetch?: unknown }).fetch;
    const { impl, calls } = fetchDouble([{ text: listPayload }]);

    try {
      const transport = createCatalogHttpTransport({ baseUrl: 'http://catalog.invalid', fetchImpl: impl });
      await transport.listCatalogs();
    } finally {
      (globalThis as { fetch?: unknown }).fetch = globalFetch;
    }

    expect(calls[0].url).toBe('http://catalog.invalid/api/1.0.0/catalogs?page=1&size=500');
  });

  it('resolves the base URL per request, so a repointed host is honoured', async () => {
    expect.hasAssertions();

    // `baseUrl` as a function is the failover seam: capturing it once at
    // construction would keep every request pointed at the host that was
    // already known to be down.
    let host = 'http://first.invalid/';
    const { impl, calls } = fetchDouble([{ text: listPayload }, { text: listPayload }]);
    const transport = createCatalogHttpTransport({ baseUrl: () => host, fetchImpl: impl });

    await transport.listCatalogs();
    host = 'http://second.invalid';
    await transport.listCatalogs();

    // Trailing slash removed, prefix appended, second request on the new host.
    expect(calls[0].url).toBe('http://first.invalid/api/1.0.0/catalogs?page=1&size=500');
    expect(calls[1].url).toBe('http://second.invalid/api/1.0.0/catalogs?page=1&size=500');
  });

  it('builds a usable path from the declared base URL and a custom prefix', async () => {
    expect.hasAssertions();

    const { impl, calls } = fetchDouble([{ text: listPayload }]);
    const transport = createCatalogHttpTransport({ baseUrl: 'http://catalog.invalid', fetchImpl: impl, apiPrefix: '/api/2.0.0' });

    await transport.listCatalogs();

    expect(calls[0].url).toBe('http://catalog.invalid/api/2.0.0/catalogs?page=1&size=500');
  });

  it('sends the bearer token only when the provider returns one', async () => {
    expect.hasAssertions();

    const anonymous = fetchDouble([{ text: listPayload }]);
    await createCatalogHttpTransport({ baseUrl: 'http://catalog.invalid', fetchImpl: anonymous.impl }).listCatalogs();

    const authenticated = fetchDouble([{ text: listPayload }]);
    await createCatalogHttpTransport({
      baseUrl: 'http://catalog.invalid',
      fetchImpl: authenticated.impl,
      tokenProvider: () => 'Bearer token-1'
    }).listCatalogs();

    // An empty token must not become `Authorization: ""` — some gateways treat
    // a present-but-empty header as a malformed credential and answer 400.
    expect(anonymous.calls[0].init.headers.Authorization).toBeUndefined();
    expect(authenticated.calls[0].init.headers.Authorization).toBe('Bearer token-1');
  });

  it('sends a JSON body and its content type only when there is a body', async () => {
    expect.hasAssertions();

    const { impl, calls } = fetchDouble([{ text: '{"id":"cat-1"}' }, { text: '{"id":"cat-1"}' }]);
    const transport = createCatalogHttpTransport({ baseUrl: 'http://catalog.invalid', fetchImpl: impl });

    await transport.createCatalog({ name: 'Domain' });
    await transport.getCatalog('cat-1');

    expect(calls[0].init.body).toBe('{"name":"Domain"}');
    expect(calls[0].init.headers['Content-Type']).toBe('application/json; charset=utf-8');
    expect(calls[1].init.body).toBeUndefined();
    expect(calls[1].init.headers['Content-Type']).toBeUndefined();
  });

  it('percent-encodes identifiers into the path', async () => {
    expect.hasAssertions();

    // An id with a slash would otherwise address a different resource
    // entirely — `/catalogs/a/b` is not `/catalogs/a%2Fb`.
    const { impl, calls } = fetchDouble([{ text: '' }, { text: '' }, { text: '' }]);
    const transport = createCatalogHttpTransport({ baseUrl: 'http://catalog.invalid', fetchImpl: impl });

    await transport.getCatalog('a/b');
    await transport.updateCatalog('a b', { version: 2 });
    await transport.restoreCatalog('a#b', 4);

    expect(calls[0].url).toBe('http://catalog.invalid/api/1.0.0/catalogs/a%2Fb');
    expect(calls[1].url).toBe('http://catalog.invalid/api/1.0.0/catalogs/a%20b');
    expect(calls[2].url).toBe('http://catalog.invalid/api/1.0.0/catalogs/a%23b/restore');
    expect(calls[2].init.body).toBe('{"version":4}');
  });

  it('carries the version on a delete, where losing it would delete blindly', async () => {
    expect.hasAssertions();

    // The version is the optimistic-concurrency check. Dropped from the query
    // string, the backend has nothing to compare and a stale delete succeeds.
    const { impl, calls } = fetchDouble([{ text: '' }]);

    await createCatalogHttpTransport({ baseUrl: 'http://catalog.invalid', fetchImpl: impl }).deleteCatalog('cat-1', 7);

    expect(calls[0].init.method).toBe('DELETE');
    expect(calls[0].url).toBe('http://catalog.invalid/api/1.0.0/catalogs/cat-1?version=7');
  });

  it('pages the listing, and asks for tombstones only when told to', async () => {
    expect.hasAssertions();

    const { impl, calls } = fetchDouble([{ text: listPayload }, { text: listPayload }]);
    const transport = createCatalogHttpTransport({ baseUrl: 'http://catalog.invalid', fetchImpl: impl });

    await transport.listCatalogs({ page: 2, size: 10 });
    await transport.listCatalogs({ includeDeleted: true });

    expect(calls[0].url).toBe('http://catalog.invalid/api/1.0.0/catalogs?page=2&size=10');
    expect(calls[1].url).toBe('http://catalog.invalid/api/1.0.0/catalogs?page=1&size=500&includeDeleted=true');
  });

  it('returns an empty list rather than a non-list payload', async () => {
    expect.hasAssertions();

    // A payload without `result` — an error envelope, a proxy's HTML — must not
    // reach the sync loop as something it will try to iterate.
    const { impl } = fetchDouble([
      { text: JSON.stringify({ result: [{ id: 'cat-1' }] }) },
      { text: JSON.stringify({ message: 'no' }) },
      { text: '' }
    ]);
    const transport = createCatalogHttpTransport({ baseUrl: 'http://catalog.invalid', fetchImpl: impl });

    await expect(transport.listCatalogs()).resolves.toStrictEqual([{ id: 'cat-1' }]);
    await expect(transport.listCatalogs()).resolves.toStrictEqual([]);
    await expect(transport.listCatalogs()).resolves.toStrictEqual([]);
  });

  it('reads an empty body as null instead of failing to parse it', async () => {
    expect.hasAssertions();

    // 204-shaped answers are normal for delete; `JSON.parse('')` throws.
    const { impl } = fetchDouble([{ text: '' }]);

    await expect(createCatalogHttpTransport({ baseUrl: 'http://catalog.invalid', fetchImpl: impl }).deleteCatalog('cat-1', 1)).resolves
      .toBeNull();
  });

  it('survives a body that is not JSON at all', async () => {
    expect.hasAssertions();

    // A gateway's HTML error page, answered with a 200. Parsing has to fail
    // softly, because throwing here would report as a transport outage.
    const { impl } = fetchDouble([{ text: '<html>gateway</html>' }]);

    await expect(createCatalogHttpTransport({ baseUrl: 'http://catalog.invalid', fetchImpl: impl }).getCatalog('cat-1')).resolves.toBeNull();
  });

  it('turns a rejected write into an error carrying the status and the body', async () => {
    expect.hasAssertions();

    // This is how a stale write becomes a reviewable conflict: the 409's body
    // holds the server's version, and the sync client reads it off the error.
    const { impl } = fetchDouble([{
      ok: false,
      status: 409,
      text: JSON.stringify({ result: { version: 9 } })
    }]);

    const failure = await createCatalogHttpTransport({ baseUrl: 'http://catalog.invalid', fetchImpl: impl })
      .updateCatalog('cat-1', { version: 3 })
      .catch((error: Error & { status?: number; body?: unknown }) => error);

    expect(failure.message).toBe('Catalog API PUT /catalogs/cat-1 failed with status 409');
    expect(failure.status).toBe(409);
    expect(failure.body).toStrictEqual({ result: { version: 9 } });
  });

  it('keeps the status on a failure whose body cannot be parsed', async () => {
    expect.hasAssertions();

    const { impl } = fetchDouble([{ ok: false, status: 502, text: 'Bad Gateway' }]);

    const failure = await createCatalogHttpTransport({ baseUrl: 'http://catalog.invalid', fetchImpl: impl })
      .listCatalogs()
      .catch((error: Error & { status?: number; body?: unknown }) => error);

    expect(failure.status).toBe(502);
    expect(failure.body).toBeNull();
  });
});
