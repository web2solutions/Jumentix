/**
 * Real dedicated Worker hosting the Cana engine (JUM-615).
 *
 * Complements `worker-host.cy.ts` (MessageChannel on one thread) by proving
 * `new Worker(...)` loads the host, serves requests, broadcasts changes, and
 * surfaces timeout/`Unavailable` when the worker is killed.
 */

import {
  createRouter,
  createWorkerClient,
  isCanaErrorCode
} from '../src';
import { rejection } from './harness';

const WORKER_BUNDLE = '.browser-tests/cana/cana-real-worker.js';

describe('cana real dedicated Worker', () => {
  it('round-trips CRUD and broadcasts through a real Worker', () => {
    cy.readFile(WORKER_BUNDLE).then(async (source: string) => {
      const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
      const worker = new Worker(url);
      const broadcasts: unknown[] = [];
      const router = createRouter({
        port: worker as unknown as Parameters<typeof createRouter>[0]['port'],
        timeoutMs: 5000,
        onBroadcast: (event) => broadcasts.push(event)
      });
      const api = createWorkerClient(router);

      try {
        expect(await api.ping()).to.equal('pong');
        await api.open();
        await api.put('designs', { id: 1, name: 'worker', owner: 'ana' });
        const row = await api.get<{ id: number; name: string }>('designs', 1);
        expect(row).to.deep.equal({ id: 1, name: 'worker', owner: 'ana' });
        const rows = await api.query<{ id: number }>('designs');
        expect(rows).to.have.length(1);
        // Change broadcasts are best-effort; give the host a turn to deliver.
        await new Promise((resolve) => { setTimeout(resolve, 50); });
        expect(broadcasts.length).to.be.greaterThan(0);
        await api.close();
      } finally {
        router.dispose();
        worker.terminate();
        URL.revokeObjectURL(url);
      }
    });
  });

  it('times out in-flight work when the Worker is terminated', () => {
    cy.readFile(WORKER_BUNDLE).then(async (source: string) => {
      const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
      const worker = new Worker(url);
      const router = createRouter({
        port: worker as unknown as Parameters<typeof createRouter>[0]['port'],
        timeoutMs: 500
      });
      const api = createWorkerClient(router);

      try {
        await api.open();
        worker.terminate();
        const failure = await rejection(api.ping());
        expect(
          isCanaErrorCode(failure, 'Unavailable')
          || isCanaErrorCode(failure, 'UnknownOutcome')
        ).to.equal(true);
      } finally {
        router.dispose();
        URL.revokeObjectURL(url);
      }
    });
  });
});
