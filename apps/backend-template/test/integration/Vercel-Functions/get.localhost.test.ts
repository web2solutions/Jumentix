/* global describe, it, expect, beforeAll */
import request from 'supertest';
import { vercelListener } from '../../helpers/vercelRuntime';

/**
 * JUM-698 — this suite is under `test/integration/Vercel-Functions/`, and now
 * integrates.
 *
 * It used to import `adapters/express/handlers/infraHandlers`, call the handler
 * with a fake response and assert the payload — a file named after the Vercel
 * adapter exercising the **Express** one, with `vercel-functions.ts` never
 * loaded at all.
 *
 * The deployed entry point is the default export, `handler(req, res)`. Supertest
 * drives it over a real socket, which runs the adapter's own router, its
 * parameter matching, its static-doc refusal and its response adapter.
 *
 * `vercelListener` is the named proxy here (Requirement 135 §7): Vercel passes
 * an Express-like response, not the bare `http.ServerResponse` supertest
 * supplies, so the helper adds `status`/`json`/`send` on top of the real one.
 * What that does not cover is Vercel's body parsing and header casing.
 *
 * The import is dynamic because the module compiles its clients from the
 * environment at load time and the default key-value driver is Redis; setting
 * the driver first keeps this from becoming a test of whether a Redis happens
 * to be running.
 */
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/*
 * Typed loosely on purpose: the module's own parameter types are its private
 * `VercelRequest`/`VercelResponse`, and a narrower annotation here fails under
 * Jest — which typechecks — while passing under Bun, which does not.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let handler: (req: any, res: any) => Promise<void>;

describe('vercel-functions -> /localhost suite', () => {
  beforeAll(async () => {
    process.env.JUMENTIX_KEYVALUESTORAGE_DRIVER = 'inmemory';
    process.env.JUMENTIX_DATABASE_DRIVER = 'inmemory';
    ({ default: handler } = await import(
      '@src/interface/HTTP/adapters/vercel-functions/vercel-functions'
    ));
  });

  it('answers the root route through the function entry point', async () => {
    expect.hasAssertions();

    const response = await request(vercelListener(handler))
      .get('/')
      .set('Accept', 'application/json');

    expect(response.statusCode).toBe(200);
    expect(response.body.status).toBe('result');
    // Minted per request. The old form supplied this value itself, which is a
    // test asserting its own input.
    expect(response.body.correlationId).toMatch(UUID_V4);
  });

  it('gives each request its own correlation id', async () => {
    expect.hasAssertions();

    const first = await request(vercelListener(handler)).get('/').set('Accept', 'application/json');
    const second = await request(vercelListener(handler)).get('/').set('Accept', 'application/json');

    expect(first.body.correlationId).not.toBe(second.body.correlationId);
  });

  it('answers an unknown route with 404 rather than the root payload', async () => {
    expect.hasAssertions();

    // The route matching is the part a direct handler call skips entirely.
    const response = await request(vercelListener(handler)).get('/not-a-route');

    expect(response.statusCode).toBe(404);
  });
});
