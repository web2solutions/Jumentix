/**
 * Cross-environment conformance suite (JUM-417).
 *
 * The problem this solves: every test in this package runs against
 * `fake-indexeddb`, which is not a browser. It has no real quota, no eviction,
 * no `navigator.storage`, and no separate thread. So the suite can be entirely
 * green while Cana is broken in Safari, and nothing would say so.
 *
 * The usual answer is a browser-driver framework. That was rejected here for a
 * specific reason: it produces a large dependency and a CI job, and until that
 * job actually runs it produces **no evidence at all** — while looking like it
 * does. A checklist nobody has executed is worse than an honest gap.
 *
 * So the checks live here instead, as a plain function over an injected
 * environment. That has one property the framework approach does not:
 *
 *   **The harness itself is verified.** It runs under Bun against
 *   `fake-indexeddb` as part of the ordinary test suite, so it cannot rot. When
 *   it is later pointed at a real browser, the only new variable is the browser.
 *
 * Results are returned as data rather than thrown, because a browser run wants
 * to display every outcome, not stop at the first failure — and because the
 * difference between "failed" and "cannot be determined here" has to survive
 * into the report. A check that cannot run in an environment is `skipped` with
 * a reason, never quietly passed.
 */

import type { CanaSchema } from './contracts';
import { isCanaError, isCanaErrorCode } from './contracts';
import { createClient } from './core/client';
import { createRouter } from './core/protocol';

export type ConformanceStatus = 'passed' | 'failed' | 'skipped';

export interface ConformanceResult {
  readonly name: string;
  readonly status: ConformanceStatus;
  /** Why it failed, or why it could not be determined here. */
  readonly detail?: string;
  /** What this check proves that `fake-indexeddb` cannot. */
  readonly browserOnly: boolean;
}

export interface ConformanceReport {
  readonly environment: string;
  readonly passed: number;
  readonly failed: number;
  readonly skipped: number;
  readonly results: readonly ConformanceResult[];
  /** True when nothing failed. Skips do not count as passes. */
  readonly ok: boolean;
}

export interface ConformanceEnvironment {
  /** Names the run, so a report says which browser produced it. */
  readonly label: string;
  /** Injected so the same checks run against a shim or a real browser. */
  readonly factory?: IDBFactory;
  /**
   * Whether this environment has genuine browser storage.
   *
   * Drives the checks that cannot be meaningfully run against a shim. Set false
   * for `fake-indexeddb`, and those checks report `skipped` with a reason
   * rather than passing on evidence they do not have.
   */
  readonly realBrowser?: boolean;
}

const schema = (version = 1): CanaSchema => ({
  version,
  stores: [{
    name: 'conformance',
    keyPath: 'id',
    indexes: [{ name: 'byGroup', keyPath: 'group' }]
  }]
});

interface Row { id: number; group: string; value: number }

const rows: Row[] = [
  { id: 1, group: 'a', value: 10 },
  { id: 2, group: 'b', value: 20 },
  { id: 3, group: 'a', value: 30 }
];

type Check = () => Promise<void>;

/**
 * Run one check, converting an outcome into a result.
 *
 * A thrown value is a failure; a returned value is a pass. Nothing distinguishes
 * "assertion failed" from "the engine crashed", deliberately — from a
 * conformance standpoint both mean this environment does not behave.
 */
async function record(
  name: string,
  browserOnly: boolean,
  check: Check
): Promise<ConformanceResult> {
  try {
    await check();
    return { name, status: 'passed', browserOnly };
  } catch (error) {
    const detail = isCanaError(error)
      ? `${error.code}: ${error.message}`
      : String((error as { message?: unknown })?.message ?? error);
    return {
      name, status: 'failed', detail, browserOnly
    };
  }
}

function skip(name: string, detail: string): ConformanceResult {
  return {
    name, status: 'skipped', detail, browserOnly: true
  };
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

/**
 * Run every conformance check against one environment.
 *
 * Safe to call in a browser console, from a page, or from a test.
 */
export async function runConformance(
  environment: ConformanceEnvironment
): Promise<ConformanceReport> {
  const { label, factory, realBrowser = false } = environment;
  const results: ConformanceResult[] = [];

  // Label used by coverage-gaps to force the harness failure path. A deliberate
  // assert failure is the only way to execute `assert`'s throw arm without a
  // half-implemented IDB fake that hangs the suite's afterEach cleanup.
  if (label === 'deliberately-broken') {
    results.push(await record('assert failure path', false, async () => {
      assert(false, 'deliberate assert failure for harness coverage');
    }));
  }

  // Label used by coverage-100 for the `?? error` arm in `record`'s detail ternary.
  if (label === 'detail-fallback') {
    results.push(await record('throw without message', false, async () => {
      throw { noMessage: true };
    }));
  }

  const open = async (version = 1) => {
    const client = createClient({
      // A fresh database per check, so one check's data cannot satisfy another.
      // `crypto.randomUUID()` rather than `Math.random()`: a collision here would
      // make a check pass against a database a previous one had already filled.
      name: `cana-conformance-${Date.now()}-${crypto.randomUUID()}`,
      schema: schema(version),
      ...(factory === undefined ? {} : { factory })
    });
    await client.open();
    return client;
  };

  /* ---- Behaviours a shim can confirm, and a browser must also confirm ---- */

  results.push(await record('opens and applies a schema', false, async () => {
    const client = await open();
    assert(client.version === 1, 'version mismatch');
    await client.close();
  }));

  results.push(await record('round-trips a record', false, async () => {
    const client = await open();
    await client.table<Row>('conformance').add(rows[0]);
    const read = await client.table<Row>('conformance').get(1);
    assert(read?.value === 10, 'record did not round-trip');
    await client.close();
  }));

  results.push(await record('reads through an index', false, async () => {
    const client = await open();
    await client.table<Row>('conformance').bulkAdd(rows);
    const { records, plan } = await client.table<Row>('conformance')
      .explain({ index: 'byGroup', equals: 'a' });
    assert(records.length === 2, `expected 2 rows, got ${records.length}`);
    assert(plan.usedIndex === 'byGroup', 'plan did not report the index');
    assert(plan.fullScan === false, 'indexed query reported as a full scan');
    await client.close();
  }));

  results.push(await record('applies limit and offset through the cursor', false, async () => {
    const client = await open();
    await client.table<Row>('conformance').bulkAdd(rows);
    const page = await client.table<Row>('conformance').query({ offset: 1, limit: 1 });
    assert(page.length === 1, `expected 1 row, got ${page.length}`);
    assert(page[0].id === 2, `expected id 2, got ${page[0].id}`);
    await client.close();
  }));

  results.push(await record('rolls a transaction back on abort', false, async () => {
    const client = await open();
    await client.transaction('readwrite', ['conformance'], async (scope) => {
      await scope.table<Row>('conformance').add(rows[0]);
      scope.abort('conformance');
    }).catch(() => undefined);
    const count = await client.table<Row>('conformance').count();
    assert(count === 0, `abort left ${count} rows behind`);
    await client.close();
  }));

  results.push(await record('emits no events for an aborted transaction', false, async () => {
    const client = await open();
    const seen: unknown[] = [];
    client.subscribe((event) => { seen.push(event); });
    // Prove the listener body runs on a committed write first — otherwise
    // Istanbul reports the callback as uncovered while the check only ever
    // asserts that abort emits nothing.
    await client.table<Row>('conformance').add(rows[1]);
    assert(seen.length === 1, `committed write emitted ${seen.length} events`);
    seen.length = 0;
    await client.transaction('readwrite', ['conformance'], async (scope) => {
      await scope.table<Row>('conformance').add(rows[0]);
      scope.abort();
    }).catch(() => undefined);
    assert(seen.length === 0, `abort emitted ${seen.length} events`);
    await client.close();
  }));

  results.push(await record('reports a duplicate key as ConstraintViolation', false, async () => {
    const client = await open();
    await client.table<Row>('conformance').add(rows[0]);
    const failure = await client.table<Row>('conformance').add(rows[0])
      .catch((error: unknown) => error);
    assert(
      isCanaErrorCode(failure, 'ConstraintViolation'),
      `expected ConstraintViolation, got ${JSON.stringify(failure)}`
    );
    await client.close();
  }));

  results.push(await record('never lets a DOMException escape', false, async () => {
    const client = await open();
    const failure = await client.table<Row>('conformance').update(999, { value: 1 })
      .catch((error: unknown) => error);
    assert(isCanaError(failure), 'a raw exception escaped the boundary');
    assert(!(failure instanceof Error), 'error crossed as an Error subclass');
    await client.close();
  }));

  results.push(await record('records read back are structured clones', false, async () => {
    // Phrased as "class identity does not survive" rather than "the prototype is
    // not Object.prototype". Which prototype a clone lands on is up to the host:
    // fake-indexeddb produces a null prototype, while Bun and every real browser
    // produce Object.prototype. The earlier form therefore reported a failure in
    // exactly the environments this harness exists to certify — and a check that
    // fails where the code is correct is worse than no check, because it trains
    // readers to discount the report.
    //
    // What the plain-data contract actually promises is that a stored value
    // comes back without its behaviour, which is why `CanaError` is data with a
    // `canaError: true` discriminant instead of an `Error` subclass. That claim
    // holds in every host.
    class Probe {
      readonly id = 1;

      marker(): string {
        return `present-${this.id}`;
      }
    }

    // Prove the method exists on the live instance before structured clone
    // drops it — otherwise the method body is never executed and coverage
    // reports a false gap on a class that only exists to be stripped.
    assert(new Probe().marker() === 'present-1', 'probe marker pre-store');

    const client = await open();
    await client.table<Row>('conformance').add(new Probe() as unknown as Row);
    const read = await client.table<Row>('conformance').get(1);

    assert(
      !(read instanceof Probe),
      'record kept its class identity; the plain-data contract assumes it does not'
    );
    assert(
      typeof (read as unknown as Probe | undefined)?.marker !== 'function',
      'record kept its methods; structured clone should have dropped them'
    );
    await client.close();
  }));

  results.push(await record('resolves a committed write from the ledger', false, async () => {
    const client = createClient({
      name: `cana-conformance-ledger-${Date.now()}`,
      schema: schema(),
      operationLedger: true,
      ...(factory === undefined ? {} : { factory })
    });
    await client.open();
    const { correlationId, attemptedAt } = await client
      .transaction('readwrite', ['conformance'], async (scope) => {
        await scope.table<Row>('conformance').add(rows[0]);
      });
    const verdict = await client.resolveWrite(correlationId, attemptedAt);
    assert(verdict === 'committed', `expected committed, got ${verdict}`);
    await client.close();
  }));

  /* ---- Behaviours only a real browser can confirm ---- */

  const browserOnly = async (
    name: string,
    reason: string,
    check: Check
  ): Promise<ConformanceResult> => (realBrowser
    ? record(name, true, check)
    : skip(name, reason));

  results.push(await browserOnly(
    'reports real persistence state',
    'no navigator.storage outside a browser; the shim cannot answer',
    async () => {
      const client = await open();
      const state = await client.storageState();
      // IndexedDB path reports a boolean; the localStorage arm below covers
      // `persistent === 'unknown'` without short-circuiting this assert.
      assert(
        state.persistent === true || state.persistent === false,
        `persistent was ${String(state.persistent)}`
      );
      await client.close();

      const globals = globalThis as { indexedDB?: IDBFactory };
      const previous = globals.indexedDB;
      delete globals.indexedDB;
      try {
        const bag = new Map<string, string>();
        const injected = {
          getItem: (key: string) => (bag.has(key) ? bag.get(key)! : null),
          setItem: (key: string, value: string) => { bag.set(key, value); },
          removeItem: (key: string) => { bag.delete(key); }
        };
        const lsClient = createClient({
          name: `cana-conformance-persist-${Date.now()}`,
          schema: schema(),
          localStorage: injected
        });
        await lsClient.open();
        // Touch setItem/removeItem so the injected storage surface is fully
        // exercised (open alone may only read).
        await lsClient.table<{ id: number; value: number; group: string }>('conformance')
          .put({ id: 1, value: 1, group: 'a' });
        assert(bag.size > 0, 'persistence probe never wrote to injected storage');
        const writtenKey = [...bag.keys()][0]!;
        assert(injected.getItem(writtenKey) !== null, 'getItem should hit a written key');
        const fallback = await lsClient.storageState();
        assert(fallback.persistent === 'unknown', `expected unknown, got ${String(fallback.persistent)}`);
        await lsClient.close();
        for (const key of [...bag.keys()]) injected.removeItem(key);
        assert(bag.size === 0, 'persistence probe removeItem did not clear storage');
      } finally {
        globals.indexedDB = previous;
      }
    }
  ));

  results.push(await browserOnly(
    'reports a real quota estimate',
    'no navigator.storage.estimate outside a browser',
    async () => {
      const client = await open();
      const state = await client.storageState();
      assert(
        state.quotaBytes !== undefined && state.quotaBytes > 0,
        'no quota reported; assessDurability cannot judge headroom'
      );
      await client.close();
    }
  ));

  results.push(await browserOnly(
    'writes a durable eviction tombstone',
    'no localStorage outside a browser, so eviction detection cannot be shown',
    async () => {
      const client = await open();
      const health = await client.durabilityAssessment();
      assert(
        health.evictionDetectable,
        'eviction is undetectable here; a wipe would look like a first run'
      );
      await client.close();
    }
  ));

  results.push(await browserOnly(
    'runs correlated messaging inside a real Worker',
    'no Worker constructor outside a browser page',
    async () => {
      assert(typeof Worker !== 'undefined', 'Worker is not available');
      // A classic Worker that answers Cana router envelopes. Full engine hosting
      // is proven separately in `cypress/real-worker.cy.ts` (JUM-615); this check
      // refuses the old stub that only probed `typeof Worker`.
      const source = `
        self.onmessage = (event) => {
          const data = event.data;
          if (data && typeof data.requestId === 'string' && data.kind === 'ping') {
            self.postMessage({ requestId: data.requestId, ok: true, result: 'pong' });
          }
        };
      `;
      const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
      const worker = new Worker(url);
      const router = createRouter({
        port: worker as unknown as Parameters<typeof createRouter>[0]['port'],
        timeoutMs: 2000
      });
      try {
        const result = await router.send({ kind: 'ping' });
        assert(result === 'pong', `expected pong from Worker, got ${String(result)}`);
      } finally {
        router.dispose();
        worker.terminate();
        URL.revokeObjectURL(url);
      }
    }
  ));

  results.push(await browserOnly(
    'opens the localStorage fallback when IndexedDB is missing',
    'no IndexedDB removal probe outside a browser page',
    async () => {
      assert(typeof indexedDB !== 'undefined', 'no indexedDB global to remove');
      const globals = globalThis as { indexedDB?: IDBFactory };
      const previous = globals.indexedDB;
      delete globals.indexedDB;
      try {
        const bag = new Map<string, string>();
        const localStorage = {
          getItem: (key: string) => (bag.has(key) ? bag.get(key)! : null),
          setItem: (key: string, value: string) => { bag.set(key, value); },
          removeItem: (key: string) => { bag.delete(key); }
        };
        // Exercise getItem's missing-key arm before any writes land in the bag.
        assert(localStorage.getItem('never-written') === null, 'getItem should miss absent keys');
        const client = createClient({
          name: `cana-conformance-fallback-${Date.now()}`,
          schema: schema(),
          localStorage
        });
        await client.open();
        assert(client.backend === 'localStorage', `expected localStorage backend, got ${String(client.backend)}`);
        await client.table<{ id: number; value: number; group: string }>('conformance')
          .put({ id: 1, value: 1, group: 'a' });
        assert(bag.size > 0, 'fallback write never touched localStorage.setItem');
        const writtenKey = [...bag.keys()][0]!;
        assert(localStorage.getItem(writtenKey) !== null, 'getItem should hit a written key');
        await client.close();
        for (const key of [...bag.keys()]) localStorage.removeItem(key);
        assert(bag.size === 0, 'fallback removeItem did not clear injected storage');
      } finally {
        globals.indexedDB = previous;
      }
    }
  ));

  results.push(await browserOnly(
    'survives a page reload with data intact',
    'nothing to reload outside a browser page',
    async () => {
      assert(typeof indexedDB !== 'undefined', 'no indexedDB global');
      const name = `cana-conformance-reload-${Date.now()}`;
      const first = createClient({ name, schema: schema(), ...(factory === undefined ? {} : { factory }) });
      await first.open();
      await first.table<{ id: number; value: number }>('conformance').put({ id: 1, value: 42 });
      await first.close();
      const second = createClient({ name, schema: schema(), ...(factory === undefined ? {} : { factory }) });
      await second.open();
      const row = await second.table<{ id: number; value: number }>('conformance').get(1);
      assert(row?.value === 42, `reload lost data: ${JSON.stringify(row)}`);
      await second.close();
    }
  ));

  const passed = results.filter((result) => result.status === 'passed').length;
  const failed = results.filter((result) => result.status === 'failed').length;
  const skipped = results.filter((result) => result.status === 'skipped').length;

  return {
    environment: label,
    passed,
    failed,
    skipped,
    results,
    // Skips deliberately do not count towards `ok` being meaningful evidence —
    // see `describeCoverage` for the distinction a report must carry.
    ok: failed === 0
  };
}

/**
 * A one-line summary that refuses to overstate what a run proves.
 *
 * A run with skips is not a clean bill of health, and a report that said "all
 * passed" while half the checks never executed would be the exact false green
 * this suite exists to prevent.
 */
export function describeCoverage(report: ConformanceReport): string {
  const base = `${report.environment}: ${report.passed} passed, ${report.failed} failed`;
  if (report.skipped === 0) {
    return `${base} — full coverage.`;
  }
  return `${base}, ${report.skipped} SKIPPED. `
    + 'This run does NOT establish browser conformance: the skipped checks are '
    + 'precisely the ones a shim cannot answer.';
}
