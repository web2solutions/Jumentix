import {
  afterEach, beforeEach, describe, expect, it, mock
} from 'bun:test';

import { createApiClient } from '@/contracts/apiClient';

interface RecordedCall {
  url: string;
  method: string;
  body: unknown;
  headers: Record<string, string>;
}

const recorded: RecordedCall[] = [];
let responseStatus = 200;
let responseBody: unknown = {};

describe('apiClient contract mapping (OAS bundled, JUM-760)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    recorded.length = 0;
    responseStatus = 200;
    responseBody = { Authorization: 'Bearer test-token' };
    // mock() lives inside the hook (jest/require-hook): the jest plugin rules
    // also guard this bun:test suite under the monorepo lint.
    globalThis.fetch = mock((url: string, init: {
      method: string;
      headers: Record<string, string>;
      body?: string;
    }) => {
      recorded.push({
        url: String(url),
        method: init.method,
        body: init.body ? JSON.parse(init.body) : undefined,
        headers: init.headers
      });
      return Promise.resolve({
        ok: responseStatus >= 200 && responseStatus < 300,
        status: responseStatus,
        headers: { get: (name: string) => (name === 'content-type' ? 'application/json' : null) },
        json: () => Promise.resolve(responseBody),
        text: () => Promise.resolve(JSON.stringify(responseBody))
      } as unknown as Response);
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('maps login to POST /auth/login from the bundled OAS', async () => {
    expect.assertions(4);
    const client = createApiClient('http://backend.test/api/1.0.0');

    const response = await client.request<{ Authorization: string }>({
      operationId: 'login',
      body: { username: 'me@mydomain.com', password: 'secret', schemaType: 'Bearer' }
    });

    expect(recorded[0].method).toBe('POST');
    expect(recorded[0].url).toBe('http://backend.test/api/1.0.0/auth/login');
    expect(recorded[0].body).toEqual({
      username: 'me@mydomain.com',
      password: 'secret',
      schemaType: 'Bearer'
    });
    expect(response.Authorization).toBe('Bearer test-token');
  });

  it('maps register to POST /auth/register from the bundled OAS', async () => {
    expect.assertions(3);
    responseStatus = 201;
    responseBody = { id: 'user-1' };
    const client = createApiClient('http://backend.test/api/1.0.0');

    await client.request({
      operationId: 'register',
      body: { firstName: 'Abraham', username: 'me@mydomain.com', password: 'StrongPass#123' }
    });

    expect(recorded[0].method).toBe('POST');
    expect(recorded[0].url).toBe('http://backend.test/api/1.0.0/auth/register');
    expect(recorded[0].body).toEqual({
      firstName: 'Abraham',
      username: 'me@mydomain.com',
      password: 'StrongPass#123'
    });
  });

  it('maps logout to POST /auth/logout and forwards the bearer header', async () => {
    expect.assertions(3);
    const client = createApiClient('http://backend.test/api/1.0.0');

    await client.request({
      operationId: 'logout',
      body: { username: 'me@mydomain.com' },
      headers: { Authorization: 'Bearer test-token' }
    });

    expect(recorded[0].method).toBe('POST');
    expect(recorded[0].url).toBe('http://backend.test/api/1.0.0/auth/logout');
    expect(recorded[0].headers.Authorization).toBe('Bearer test-token');
  });

  it('rejects operationIds that the OAS does not declare', async () => {
    expect.assertions(1);
    const client = createApiClient('http://backend.test/api/1.0.0');

    await expect(client.request({ operationId: 'notInTheSpec' })).rejects.toThrow(
      'Operation "notInTheSpec" not found in OpenAPI spec.'
    );
  });
});
