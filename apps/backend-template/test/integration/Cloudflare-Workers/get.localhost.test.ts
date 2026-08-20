/* global describe, it, expect, beforeAll */

/**
 * JUM-698 — this suite is under `test/integration/Cloudflare-Workers/`, and now
 * integrates.
 *
 * What it used to do was worse than asserting a mock. It imported
 * `adapters/express/handlers/infraHandlers`, called the handler with a fake
 * response object, and asserted the payload — so a file named after the
 * Cloudflare Workers adapter exercised the **Express** one, and the whole of
 * `cloudflare-workers.ts` could have been deleted without turning it red.
 *
 * The worker entry point is `fetch(request)`, the same export Cloudflare calls.
 * Driving it runs the Hono router, the adapter's request builder, its response
 * adapter and the lazy `API.start()`. There is no server to listen on, because
 * a worker has none.
 *
 * The import is dynamic because the module compiles its clients from the
 * environment at load time, and the default key-value driver is Redis. Setting
 * the driver first is what keeps this suite from silently becoming a test of
 * whether a Redis happens to be running.
 */
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

let workerFetch: (request: Request) => Promise<Response>;

describe('cloudflare-workers -> /localhost suite', () => {
  beforeAll(async () => {
    process.env.JUMENTIX_KEYVALUESTORAGE_DRIVER = 'inmemory';
    process.env.JUMENTIX_DATABASE_DRIVER = 'inmemory';
    ({ fetch: workerFetch } = await import(
      '@src/interface/HTTP/adapters/cloudflare-workers/cloudflare-workers'
    ));
  });

  it('answers the root route through the worker fetch handler', async () => {
    expect.hasAssertions();

    const response = await workerFetch(new Request('http://localhost/'));
    const body = await response.json() as { status: string; correlationId: string };

    expect(response.status).toBe(200);
    expect(body.status).toBe('result');
    // Minted per request by the correlation middleware. The old form supplied
    // this value itself, which is a test asserting its own input.
    expect(body.correlationId).toMatch(UUID_V4);
  });

  it('gives each request its own correlation id', async () => {
    expect.hasAssertions();

    const first = await (await workerFetch(new Request('http://localhost/'))).json() as {
      correlationId: string;
    };
    const second = await (await workerFetch(new Request('http://localhost/'))).json() as {
      correlationId: string;
    };

    expect(first.correlationId).not.toBe(second.correlationId);
  });

  it('answers an unknown route with 404 rather than the root payload', async () => {
    expect.hasAssertions();

    // The router is the part a direct handler call skips entirely.
    const response = await workerFetch(new Request('http://localhost/not-a-route'));

    expect(response.status).toBe(404);
  });
});
