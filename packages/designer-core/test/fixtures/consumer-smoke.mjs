/**
 * Consumer smoke fixture for `@jumentix/designer-core` (JUM-493).
 *
 * This file is executed as its own process by `test/consumer-smoke.test.ts`
 * (never imported by a runner), so the artifact is loaded the way a real
 * consumer loads it: a fresh runtime with no test-framework globals, no jsdom,
 * no shims — and, per the issue's acceptance bar, no `document`, no `window`,
 * no `localStorage`.
 *
 * The script imports the BUILT artifact (dist/index.js), asserts the non-DOM
 * environment is real, runs a validate → export → re-import round trip, and
 * prints one JSON line the calling test asserts on. Any failure exits
 * non-zero.
 */

import assert from 'node:assert/strict';

const fail = (message) => {
  console.error(`[consumer-smoke] ${message}`);
  process.exit(1);
};

// 1. The environment is genuinely non-DOM. If a future runtime ships one of
//    these globals, the proof's premise is restated, not assumed.
const ambient = ['window', 'document', 'localStorage'].filter((name) => name in globalThis);
if (ambient.length > 0) {
  fail(`expected a non-DOM process, found global(s): ${ambient.join(', ')}`);
}

// 2. The artifact loads. A DOM reference at module scope would throw here.
const artifactUrl = new URL('../../dist/index.js', import.meta.url);
const core = await import(artifactUrl.href);

// 3. Validate → export → re-import round trip on the sample model.
const state = core.normalizeStatePayload(core.buildSampleModelPayload());
const issues = core.collectModelIssues(state);
const errors = issues.filter((issue) => issue.severity === 'error');
assert.equal(errors.length, 0, `sample model must validate clean, got: ${JSON.stringify(errors)}`);

const document1 = core.buildJsonExportDocument(state);
assert.equal(document1.kind, 'service-management-suite');

// The crossing includes the wire step, as a downloaded file would.
const wire = JSON.parse(JSON.stringify(document1));
const reimported = core.normalizeStatePayload(wire);
assert.deepEqual(reimported.domains, state.domains);
assert.deepEqual(reimported.relationships, state.relationships);

// Re-export reaches a fixed point.
const document2 = core.buildJsonExportDocument(reimported);
assert.deepEqual(JSON.parse(JSON.stringify(document2)), wire);

// 4. The excluded surface stays excluded: no storage adapter, no sync client.
const leaks = ['CanaDesignerStore', 'LocalStorageDesignerStore'].filter((name) => name in core);
assert.deepEqual(leaks, [], 'storage adapters must not be exported by the core package');

// 5. The contract type is part of the surface.
assert.equal(typeof core.IDesignerStore, 'function', 'IDesignerStore must be exported as the store contract');

console.log(JSON.stringify({
  ok: true,
  exportCount: Object.keys(core).length,
  domainCount: state.domains.length,
  exports: Object.keys(core).sort()
}));
