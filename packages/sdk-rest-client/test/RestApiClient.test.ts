// Imported through the package entry point rather than the individual modules:
// that is the surface consumers actually get, and a barrel that forgot to
// re-export something would otherwise pass every test in this file.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { RestApiClient, loadSpecs } from '../src';

/**
 * Requirement 112 — this package owns its suite.
 *
 * The client turns an `operationId` into a URL and a method by reading the
 * OpenAPI document. Nothing about that is exercised by the backend's tests: they
 * call the API directly. So the mapping, the path templating and the error
 * handling were only ever confirmed by whoever ran the SDK by hand.
 *
 * `fetch` is a global here, not a module import, so it can be replaced and put
 * back without module mocking — the thing that does not work portably across
 * bun and Jest (JUM-583). The spec is the repository's real `spec/1.0.0.yml`:
 * the operation-to-route map is the contract under test, and reading a fixture
 * instead would test the fixture.
 */

type Recorded = { url: string; init: RequestInit };

/** Replaces `fetch`, records the call, and answers with the given response. */
function withFetch(response: Response) {
  const calls: Recorded[] = [];
  const original = globalThis.fetch;

  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url: String(url), init });
    return response;
  }) as unknown as typeof fetch;

  return {
    calls,
    restore: () => { globalThis.fetch = original; }
  };
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json' }
});

/** The server the client falls back to when given no base URL. */
const specServerUrl = ((): string => {
  const { openApi } = loadSpecs();
  return openApi?.servers?.[0]?.url || 'http://localhost:3000/api/1.0.0';
})();

/** An operation the repository's own spec is known to declare. */
const anOperationId = (): string => {
  const { openApi } = loadSpecs();
  for (const methods of Object.values(openApi.paths || {})) {
    for (const config of Object.values(methods as Record<string, { operationId?: string }>)) {
      if (config?.operationId) return config.operationId;
    }
  }
  throw new Error('the OpenAPI document declares no operationId');
};

describe('loadSpecs', () => {
  it('parses the OpenAPI document from the directory it is given', () => {
    expect.hasAssertions();

    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'rest-sdk-openapi-'));
    fs.writeFileSync(
      path.join(base, '1.0.0.yml'),
      'openapi: 3.0.0\nservers:\n  - url: https://example.test\n',
      'utf8'
    );

    expect(loadSpecs(base).openApi.servers).toStrictEqual([
      { url: 'https://example.test' }
    ]);
  });

  it('fails when no canonical spec exists above the module directory', () => {
    expect.hasAssertions();

    // An isolated directory under the OS temp root has no `spec/1.0.0.yml`
    // anywhere above it, so the default walk-up finds nothing.
    const isolated = fs.mkdtempSync(path.join(os.tmpdir(), 'rest-sdk-spec-'));
    expect(() => loadSpecs(undefined, isolated)).toThrow(/1\.0\.0\.yml/);
  });
});

describe('operation routing', () => {
  it('rejects an operation the spec does not declare', async () => {
    expect.hasAssertions();

    await expect(new RestApiClient('http://api.test').request({ operationId: 'no-such-op' }))
      .rejects.toThrow('Operation "no-such-op" not found in OpenAPI spec.');
  });

  it('sends the request to the base url it was given', async () => {
    expect.hasAssertions();

    const stub = withFetch(json({ ok: true }));

    try {
      await new RestApiClient('http://api.test').request({ operationId: anOperationId() });

      expect(new URL(stub.calls[0].url).origin).toBe('http://api.test');
    } finally {
      stub.restore();
    }
  });

  /**
   * With no base URL the client reads the spec's first server. Asserted because
   * the fallback chain has three links — argument, spec, hardcoded localhost —
   * and only the first is ever exercised in normal use.
   */
  it('falls back to the server declared in the spec', async () => {
    expect.hasAssertions();

    const stub = withFetch(json({ ok: true }));

    try {
      await new RestApiClient().request({ operationId: anOperationId() });

      expect(stub.calls[0].url.startsWith(specServerUrl)).toBe(true);
    } finally {
      stub.restore();
    }
  });

  it('resolves the base URL from x-service when more than one service exists', async () => {
    expect.hasAssertions();
    const stub = withFetch(json({ ok: true }));
    const multi = () => ({
      openApi: {
        'x-services': [
          { id: 'core', url: 'http://core.test/api' },
          { id: 'billing', url: 'http://billing.test/api' }
        ],
        paths: {
          '/invoices': { get: { operationId: 'listInvoices', 'x-service': 'billing' } }
        }
      }
    });
    try {
      await new RestApiClient(undefined, multi as never).request({ operationId: 'listInvoices' });
      expect(stub.calls[0].url).toBe('http://billing.test/api/invoices');
    } finally {
      stub.restore();
    }
  });

  /**
   * A spec with no `servers` block. The client falls back to a hardcoded
   * localhost, which is what a developer running the SDK against a local API
   * depends on — and the only way to reach it is a document that omits the
   * block entirely.
   */
  it('falls back to localhost when the spec declares no server', async () => {
    expect.hasAssertions();

    const stub = withFetch(json({ ok: true }));
    const bare = () => ({ openApi: { paths: { '/x': { get: { operationId: 'x' } } } } });

    try {
      await new RestApiClient(undefined, bare as never).request({ operationId: 'x' });

      expect(stub.calls[0].url.startsWith('http://localhost:3000/api/1.0.0')).toBe(true);
    } finally {
      stub.restore();
    }
  });

  it('copes with a spec that declares no paths at all', async () => {
    expect.hasAssertions();

    const empty = () => ({ openApi: { servers: [{ url: 'http://api.test' }] } });

    // No routes means every operation is unknown — reported, not crashed on.
    await expect(new RestApiClient(undefined, empty as never).request({ operationId: 'x' }))
      .rejects.toThrow('not found in OpenAPI spec');
  });
});

describe('request shape', () => {
  it('sends JSON and merges caller headers', async () => {
    expect.hasAssertions();

    const stub = withFetch(json({ ok: true }));

    try {
      await new RestApiClient('http://api.test').request({
        operationId: anOperationId(),
        body: { name: 'a' },
        headers: { authorization: 'Bearer token' }
      });

      expect(stub.calls[0].init.headers).toMatchObject({
        'content-type': 'application/json',
        authorization: 'Bearer token'
      });
      expect(stub.calls[0].init.body).toBe(JSON.stringify({ name: 'a' }));
    } finally {
      stub.restore();
    }
  });

  /**
   * No body means no body — not `"undefined"`. `JSON.stringify(undefined)`
   * returns the string `undefined`, and a GET carrying that as a payload is
   * rejected by some servers and silently accepted by others.
   */
  it('omits the body entirely when none is given', async () => {
    expect.hasAssertions();

    const stub = withFetch(json({ ok: true }));

    try {
      await new RestApiClient('http://api.test').request({ operationId: anOperationId() });

      expect(stub.calls[0].init.body).toBeUndefined();
    } finally {
      stub.restore();
    }
  });

  /**
   * Path templating is the only transformation the client performs on the route
   * it read from the spec. Untested, it would send `/users/{id}` literally and
   * the server would answer 404 for a resource that exists.
   */
  it('substitutes path parameters into the route template', async () => {
    expect.hasAssertions();

    const stub = withFetch(json({ ok: true }));

    try {
      await new RestApiClient('http://api.test').request({
        operationId: 'deleteOne',
        pathParams: { id: 42 }
      });

      expect(new URL(stub.calls[0].url).pathname).toBe('/users/42');
    } finally {
      stub.restore();
    }
  });

  it('leaves the template alone when no path parameters are given', async () => {
    expect.hasAssertions();

    const stub = withFetch(json({ ok: true }));

    try {
      await new RestApiClient('http://api.test').request({ operationId: 'deleteOne' });

      // The placeholder survives, percent-encoded by `URL`. That is the caller's
      // mistake to see rather than something for the client to guess at.
      expect(new URL(stub.calls[0].url).pathname).toBe('/users/%7Bid%7D');
    } finally {
      stub.restore();
    }
  });

  it('appends query parameters, coercing each to a string', async () => {
    expect.hasAssertions();

    const stub = withFetch(json({ ok: true }));

    try {
      await new RestApiClient('http://api.test').request({
        operationId: anOperationId(),
        query: { page: 2, active: true, name: 'a b' }
      });

      const url = new URL(stub.calls[0].url);

      expect([...url.searchParams.entries()]).toStrictEqual([
        ['page', '2'],
        ['active', 'true'],
        ['name', 'a b']
      ]);
    } finally {
      stub.restore();
    }
  });
});

describe('responses', () => {
  it('parses a JSON body', async () => {
    expect.hasAssertions();

    const stub = withFetch(json({ id: 1 }));

    try {
      const parsed = await new RestApiClient('http://api.test')
        .request({ operationId: anOperationId() });

      // Spread into a local object before comparing. `Response.json()` returns
      // one whose prototype belongs to another realm under Jest, which
      // `toStrictEqual` rejects even when the content matches exactly — so this
      // stays a strict comparison of the content rather than a loose one.
      expect({ ...(parsed as Record<string, unknown>) }).toStrictEqual({ id: 1 });
    } finally {
      stub.restore();
    }
  });

  /** Anything not declared as JSON comes back as text rather than throwing. */
  it('returns text when the content type is not JSON', async () => {
    expect.hasAssertions();

    const stub = withFetch(new Response('plain words', {
      status: 200,
      headers: { 'content-type': 'text/plain' }
    }));

    try {
      await expect(
        new RestApiClient('http://api.test').request({ operationId: anOperationId() })
      ).resolves.toBe('plain words');
    } finally {
      stub.restore();
    }
  });

  /**
   * The failure message carries the status and the server's own body. Without
   * the body the caller sees `500` and nothing about why, which is the whole
   * difference between a diagnosable failure and a support ticket.
   */
  it('reports the status and the server body on failure', async () => {
    expect.hasAssertions();

    const stub = withFetch(new Response('database unavailable', { status: 503 }));

    try {
      await expect(
        new RestApiClient('http://api.test').request({ operationId: anOperationId() })
      ).rejects.toThrow('REST request failed: 503 database unavailable');
    } finally {
      stub.restore();
    }
  });
});

describe('service routing', () => {
  const serviceSpecs = (() => ({
    openApi: {
      servers: [
        { url: 'https://core.test', 'x-service-id': 'core' },
        { url: 'https://billing.test', 'x-service-id': 'billing' }
      ],
      'x-services': [
        { id: 'core', url: 'https://core.test' }
      ],
      paths: {
        '/invoices': { get: { operationId: 'listInvoices', 'x-service': 'billing' } },
        '/health': { get: { operationId: 'getHealth' } }
      }
    }
  }) as unknown) as typeof loadSpecs;

  it('routes operations to servers named by x-service-id, not only x-services', async () => {
    expect.hasAssertions();

    const stub = withFetch(json({ ok: true }));
    try {
      const client = new RestApiClient(undefined, serviceSpecs);
      await client.request({ operationId: 'listInvoices' });
      expect(stub.calls[0].url).toBe('https://billing.test/invoices');
    } finally {
      stub.restore();
    }
  });

  it('falls back to the core service when an operation names none', async () => {
    expect.hasAssertions();

    const stub = withFetch(json({ ok: true }));
    try {
      const client = new RestApiClient('http://api.test', serviceSpecs);
      await client.request({ operationId: 'getHealth' });
      expect(stub.calls[0].url).toBe('https://core.test/health');
    } finally {
      stub.restore();
    }
  });

  it('falls back to the base URL when an operation names a service the spec does not host', async () => {
    expect.hasAssertions();
    const unknownServiceSpecs = (() => ({
      openApi: {
        servers: [
          { url: 'https://billing.test', 'x-service-id': 'billing' },
          { url: 'https://shipping.test', 'x-service-id': 'shipping' }
        ],
        paths: {
          '/legacy': { get: { operationId: 'getLegacy', 'x-service': 'unknown-service' } }
        }
      }
    }) as unknown) as typeof loadSpecs;

    const stub = withFetch(json({ ok: true }));
    try {
      const client = new RestApiClient(undefined, unknownServiceSpecs);
      await client.request({ operationId: 'getLegacy' });
      expect(stub.calls[0].url).toBe('https://billing.test/legacy');
    } finally {
      stub.restore();
    }
  });
});

describe('failure shapes', () => {
  it('returns text when the response carries no content-type header', async () => {
    expect.hasAssertions();

    const stub = withFetch(new Response(null, { status: 200 }));
    try {
      await expect(
        new RestApiClient('http://api.test').request({ operationId: anOperationId() })
      ).resolves.toBe('');
    } finally {
      stub.restore();
    }
  });

  it('stringifies non-Error rejections in the error event and rethrows them', async () => {
    expect.hasAssertions();

    const original = globalThis.fetch;
    globalThis.fetch = (async () => {
      // eslint-disable-next-line no-throw-literal
      throw 'socket gone';
    }) as unknown as typeof fetch;

    const events: Array<{ type: string; error?: unknown }> = [];
    try {
      const client = new RestApiClient('http://api.test');
      const unsubscribe = client.subscribe((event) => { events.push(event); });
      await expect(client.request({ operationId: anOperationId() })).rejects.toBe('socket gone');
      unsubscribe();
      expect(events).toContainEqual(expect.objectContaining({
        type: 'request:error',
        error: 'socket gone'
      }));
    } finally {
      globalThis.fetch = original;
    }
  });
});
