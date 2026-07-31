import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describeCoverage, runConformance } from '@jumentix/cana';

/**
 * Verifies the conformance harness itself (JUM-417).
 *
 * The harness exists to be pointed at real browsers. Running it here, against
 * `fake-indexeddb`, proves the harness works and keeps it from rotting — so
 * that when it is later run in Safari the only new variable is Safari.
 *
 * It deliberately does NOT prove browser conformance, and the last test in this
 * file asserts that the report says so.
 */

describe('cana conformance harness', () => {
  it('passes every check a shim can answer', async () => {
    expect.hasAssertions();
    const report = await runConformance({
      label: 'fake-indexeddb', factory: new IDBFactory()
    });

    expect(report.failed).toBe(0);
    expect(report.passed).toBeGreaterThanOrEqual(10);
  });

  it('skips the browser-only checks rather than passing them', async () => {
    expect.hasAssertions();
    // The property that makes this harness worth having: a check that cannot be
    // answered here reports `skipped` with a reason, never `passed`. Passing
    // them would manufacture browser evidence out of a shim.
    const report = await runConformance({
      label: 'fake-indexeddb', factory: new IDBFactory()
    });
    const browserChecks = report.results.filter((result) => result.browserOnly);

    expect(browserChecks.length).toBeGreaterThan(0);
    expect(browserChecks.every((result) => result.status === 'skipped')).toBe(true);
    expect(browserChecks.every((result) => typeof result.detail === 'string')).toBe(true);
  });

  it('gives every skip a reason a reader can act on', async () => {
    expect.hasAssertions();
    const report = await runConformance({
      label: 'fake-indexeddb', factory: new IDBFactory()
    });

    for (const result of report.results.filter((entry) => entry.status === 'skipped')) {
      expect(result.detail).toMatch(/outside a browser|cannot answer/);
    }
  });

  it('refuses to describe a partial run as full coverage', async () => {
    expect.hasAssertions();
    // The report is the artefact a human reads. If it summarised a shim run as
    // clean, this whole exercise would be the false green it exists to prevent.
    const report = await runConformance({
      label: 'fake-indexeddb', factory: new IDBFactory()
    });
    const summary = describeCoverage(report);

    expect(summary).toContain('SKIPPED');
    expect(summary).toContain('does NOT establish browser conformance');
    expect(summary).not.toContain('full coverage');
  });

  it('reports full coverage only when nothing was skipped', () => {
    expect.hasAssertions();
    const summary = describeCoverage({
      environment: 'Chrome 120',
      passed: 15,
      failed: 0,
      skipped: 0,
      results: [],
      ok: true
    });

    expect(summary).toContain('full coverage');
    expect(summary).not.toContain('SKIPPED');
  });

  it('reports a failure as not ok', () => {
    expect.hasAssertions();
    const summary = describeCoverage({
      environment: 'Safari 17',
      passed: 12,
      failed: 3,
      skipped: 0,
      results: [],
      ok: false
    });

    expect(summary).toContain('3 failed');
  });
});

/**
 * The browser-only checks, executed rather than skipped.
 *
 * Against `fake-indexeddb` they report `skipped`, which is correct and is
 * asserted above — but it also means their bodies never run, so a check that
 * threw a TypeError on its first line would look identical to one that works
 * until the day it is finally pointed at Safari.
 *
 * Declaring `realBrowser: true` while still supplying the shim forces them to
 * execute. Most will fail, because the shim genuinely cannot answer them, and
 * that is the point: a `failed` result proves the check ran and reported.
 * `runConformance` returns outcomes as data rather than throwing, precisely so a
 * report can carry that distinction.
 */
describe('cana conformance browser-only checks', () => {
  /** Hoisted so the predicate is not a branch inside a test body. */
  const isTerminal = (status: string) => ['passed', 'failed'].includes(status);
  const isFailureWithoutDetail = (r: { status: string; detail?: string }) => (
    r.status === 'failed' && !r.detail
  );

  it('executes them when the environment claims to be a browser', async () => {
    expect.hasAssertions();
    const report = await runConformance({
      label: 'shim-claiming-browser',
      factory: new IDBFactory(),
      realBrowser: true
    });

    const browserChecks = report.results.filter((result) => result.browserOnly);

    expect(browserChecks.length).toBeGreaterThan(0);
    // None may remain `skipped`: the skip branch is what `realBrowser` turns off.
    expect(browserChecks.filter((result) => result.status === 'skipped')).toStrictEqual([]);
  });

  it('reports each executed check as passed or failed, never as unknown', async () => {
    expect.hasAssertions();
    // The harness converts an outcome into a result; nothing may escape as a
    // thrown error, because a browser run wants to display every outcome rather
    // than stop at the first failure.
    const report = await runConformance({
      label: 'shim-claiming-browser',
      factory: new IDBFactory(),
      realBrowser: true
    });

    const statuses = [...new Set(
      report.results.filter((result) => result.browserOnly).map((result) => result.status)
    )].sort();

    expect(statuses.every(isTerminal)).toBe(true);
  });

  it('gives a detail for every failure so a browser report is actionable', async () => {
    expect.hasAssertions();
    const report = await runConformance({
      label: 'shim-claiming-browser',
      factory: new IDBFactory(),
      realBrowser: true
    });

    const failuresWithoutDetail = report.results
      .filter(isFailureWithoutDetail)
      .map((result) => result.name);

    expect(failuresWithoutDetail).toStrictEqual([]);
  });
});
