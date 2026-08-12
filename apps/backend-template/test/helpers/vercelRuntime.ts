/* eslint-disable @typescript-eslint/no-explicit-any */
import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * The response shape Vercel's Node runtime hands a function (JUM-698).
 *
 * **This is a stand-in, and it is the proxy in this suite** (Requirement 135
 * §7). Vercel does not pass a bare `http.ServerResponse`: it passes an
 * Express-like object with `status`, `json` and `send` on top of one. Supertest
 * passes the bare thing, so without this the adapter fails on
 * `res.status is not a function` — a fact about the harness, not about the
 * adapter.
 *
 * What it does not cover: Vercel's own body parsing, its header casing and its
 * streaming semantics. Everything below the entry point — the router, the
 * parameter matching, the static-doc refusal, the response adapter and the
 * status actually written to the socket — is the real adapter.
 */
export type VercelLikeResponse = ServerResponse & {
  status: (statusCode: number) => VercelLikeResponse;
  json: (payload: unknown) => unknown;
  send: (payload: unknown) => unknown;
};

export function asVercelResponse(response: ServerResponse): VercelLikeResponse {
  const vercelResponse = response as VercelLikeResponse;

  vercelResponse.status = (statusCode: number) => {
    vercelResponse.statusCode = statusCode;
    return vercelResponse;
  };

  vercelResponse.json = (payload: unknown) => {
    vercelResponse.setHeader('content-type', 'application/json; charset=utf-8');
    vercelResponse.end(JSON.stringify(payload));
    return payload;
  };

  vercelResponse.send = (payload: unknown) => {
    if (typeof payload === 'string') {
      vercelResponse.end(payload);
      return payload;
    }
    return vercelResponse.json(payload);
  };

  return vercelResponse;
}

/** A request listener that hands each request to the function entry point. */
export function vercelListener(handler: (req: any, res: any) => Promise<void>) {
  return (request: IncomingMessage, response: ServerResponse) => {
    handler(request, asVercelResponse(response)).catch((error: Error) => {
      response.statusCode = 500;
      response.end(JSON.stringify({ message: error.message }));
    });
  };
}
