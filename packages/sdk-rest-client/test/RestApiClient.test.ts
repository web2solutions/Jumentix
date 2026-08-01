import { RestApiClient } from '../src/RestApiClient';
import { loadSpecs } from '../src/spec/loadSpecs';

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

      expect(stub.calls[0].url.startsWith('http://api.test')).toBe(true);
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

    const { openApi } = loadSpecs();
    const expected = openApi?.servers?.[0]?.url || 'http://localhost:3000/api/1.0.0';
    const stub = withFetch(json({ ok: true }));

    try {
      await new RestApiClient().request({ operationId: anOperationId() });

      expect(stub.calls[0].url.startsWith(expected)).toBe(true);
    } finally {
      stub.restore();
    }
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
      await expect(
        new RestApiClient('http://api.test').request({ operationId: anOperationId() })
      // `toEqual`, not `toStrictEqual`: the object comes back from
      // `Response.json()` and its prototype belongs to another realm under Jest,
      // which a strict comparison rejects while the content matches exactly.
      ).resolves.toEqual({ id: 1 });
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
