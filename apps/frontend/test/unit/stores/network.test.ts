import {
  beforeEach, describe, expect, it
} from 'bun:test';
import { createPinia, setActivePinia } from 'pinia';

import { resetSharedApiClient } from '@/contracts/apiClient';
import { useNetworkStore } from '@/stores/network';

describe('network store fed by SDK events (JUM-765)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    resetSharedApiClient();
  });

  it('tracks in-flight requests and records completed ones with status and duration', async () => {
    expect.assertions(5);
    const network = useNetworkStore();
    network.start();

    const original = globalThis.fetch;
    globalThis.fetch = (() => Promise.resolve(new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    }))) as unknown as typeof fetch;

    const { getSharedApiClient } = await import('@/contracts/apiClient');
    try {
      await getSharedApiClient().request({ operationId: 'login', body: { username: 'a@b.c', password: 'x' } });
    } finally {
      globalThis.fetch = original;
    }

    expect(network.inFlight).toBe(0);
    expect(network.recent).toHaveLength(1);
    expect(network.recent[0].operationId).toBe('login');
    expect(network.recent[0].status).toBe(200);
    expect(typeof network.recent[0].durationMs).toBe('number');
  });

  it('records failures as not-ok entries', async () => {
    expect.assertions(2);
    const network = useNetworkStore();
    network.start();

    const original = globalThis.fetch;
    globalThis.fetch = (() => Promise.resolve(new Response('nope', { status: 401 }))) as unknown as typeof fetch;

    const { getSharedApiClient } = await import('@/contracts/apiClient');
    try {
      await getSharedApiClient().request({ operationId: 'login', body: { username: 'a@b.c', password: 'x' } }).catch(() => undefined);
    } finally {
      globalThis.fetch = original;
    }

    expect(network.recent[0].ok).toBe(false);
    expect(network.recent[0].status).toBe(401);
  });

  it('stop() unsubscribes from the SDK', async () => {
    expect.assertions(1);
    const network = useNetworkStore();
    network.start();
    network.stop();

    const original = globalThis.fetch;
    globalThis.fetch = (() => Promise.resolve(new Response('{}', {
      status: 200,
      headers: { 'content-type': 'application/json' }
    }))) as unknown as typeof fetch;

    const { getSharedApiClient } = await import('@/contracts/apiClient');
    try {
      await getSharedApiClient().request({ operationId: 'login', body: { username: 'a@b.c', password: 'x' } });
    } finally {
      globalThis.fetch = original;
    }

    expect(network.recent).toHaveLength(0);
  });
});
