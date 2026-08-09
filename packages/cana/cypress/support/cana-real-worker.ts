/**
 * Dedicated-worker entry for real Worker Cypress tests (JUM-615).
 *
 * Bundled as an IIFE by `ci-cd/run-browser-tests.js` and loaded via a blob URL
 * so the suite can prove `new Worker(...)` — not only MessageChannel.
 */

import type { CanaSchema } from '../../src';
import { createWorkerHost } from '../../src';

const schema: CanaSchema = {
  version: 1,
  stores: [
    { name: 'designs', keyPath: 'id', indexes: [{ name: 'byOwner', keyPath: 'owner' }] }
  ]
};

// Dedicated workers expose the global as `self`; the lint rule bans it in the
// window realm, which this file never runs in.
// eslint-disable-next-line no-restricted-globals
const scope = self as unknown as {
  addEventListener: (type: string, listener: (event: { data: unknown }) => void) => void;
  removeEventListener: (type: string, listener: (event: { data: unknown }) => void) => void;
  postMessage: (message: unknown) => void;
};

createWorkerHost({
  name: `cana-real-worker-${Date.now()}`,
  schema,
  port: scope,
  operationLedger: true
});
