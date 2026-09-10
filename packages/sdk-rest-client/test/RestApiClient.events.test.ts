import { RestApiClient } from '../src';

/**
 * JUM-765 — request lifecycle events. The SDK is the intermediary of every
 * UI↔server call; these events are what the frontend's NetworkActivity widget
 * renders. Fetch is replaced at the global boundary, same pattern as the
 * package's routing suite.
 */

type Recorded = { url: string; init: RequestInit };

function withFetch(response: Response | (() => Response)) {
  const calls: Recorded[] = [];
  const original = globalThis.fetch;

  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url: String(url), init });
    return typeof response === 'function' ? response() : response;
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

describe('request lifecycle events (JUM-765)', () => {
  const collect = (client: RestApiClient) => {
    const events: Array<Record<string, unknown>> = [];
    const push = (event: unknown) => events.push(event as Record<string, unknown>);
    return { events, unsubscribe: client.subscribe(push) };
  };

  it('emits start and success with url, status and duration', async () => {
    expect.hasAssertions();
    const client = new RestApiClient('http://api.test');
    const { events, unsubscribe } = collect(client);

    const stub = withFetch(json({ ok: true }, 201));
    try {
      await client.request({ operationId: 'register', body: { firstName: 'A', username: 'a@b.c', password: 'StrongPass#1' } });
    } finally {
      stub.restore();
    }
    unsubscribe();

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ type: 'request:start', operationId: 'register', method: 'post' });
    expect(events[1]).toMatchObject({
      type: 'request:success', operationId: 'register', method: 'post', status: 201
    });
    expect(typeof events[1].durationMs).toBe('number');
  });

  it('emits start and error with status on non-ok responses', async () => {
    expect.hasAssertions();
    const client = new RestApiClient('http://api.test');
    const { events } = collect(client);

    const stub = withFetch(new Response('not found', { status: 404 }));
    try {
      await expect(
        client.request({ operationId: 'login', body: { username: 'a@b.c', password: 'x' } })
      ).rejects.toThrow('REST request failed: 404 not found');
    } finally {
      stub.restore();
    }

    expect(events).toHaveLength(2);
    expect(events[1]).toMatchObject({ type: 'request:error', operationId: 'login', status: 404 });
  });

  it('emits error without status when fetch itself fails', async () => {
    expect.hasAssertions();
    const client = new RestApiClient('http://api.test');
    const { events } = collect(client);

    const original = globalThis.fetch;
    globalThis.fetch = (() => Promise.reject(new TypeError('fetch failed'))) as unknown as typeof fetch;
    try {
      await expect(
        client.request({ operationId: 'login', body: { username: 'a@b.c', password: 'x' } })
      ).rejects.toThrow('fetch failed');
    } finally {
      globalThis.fetch = original;
    }

    expect(events).toHaveLength(2);
    expect(events[1].type).toBe('request:error');
    expect(events[1].status).toBeUndefined();
  });

  it('unsubscribe stops further events', async () => {
    expect.hasAssertions();
    const client = new RestApiClient('http://api.test');
    const { events, unsubscribe } = collect(client);
    unsubscribe();

    const stub = withFetch(json({ ok: true }));
    try {
      await client.request({ operationId: 'login', body: { username: 'a@b.c', password: 'x' } });
    } finally {
      stub.restore();
    }

    expect(events).toHaveLength(0);
  });
});
