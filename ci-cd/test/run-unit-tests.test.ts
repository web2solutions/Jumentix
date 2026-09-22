/* eslint-disable @typescript-eslint/no-var-requires */
import path from 'node:path';

/**
 * A quarantine has to actually relieve the gate.
 *
 * The partition claimed it did — "quarantined suites still execute report-only
 * under CI node partition" — and then pushed those paths into the same list
 * whose exit status is the return value. So a quarantined suite failed the build
 * exactly as a gating one would: the entry bought visibility and no relief,
 * which is the reverse of the trade. It surfaced as cana's wall-clock
 * performance suite failing a pull request it had been removed from the gate for.
 *
 * These tests assert the two halves separately, because the claim and the
 * behaviour were separable for as long as nobody checked.
 */

const repoRoot = path.resolve(__dirname, '../..');
const {
  partitionUnitSuites,
  runBunUnit,
  runReportOnlyUnit,
  runScriptedUnit,
  runUnitTests
} = require(path.join(repoRoot, 'ci-cd', 'run-unit-tests.js'));

const ciNode = { ...process.env, CI: 'true', JUMENTIX_TEST_RUNTIME: 'node' };
const local = { ...process.env, CI: '', JUMENTIX_TEST_RUNTIME: 'bun' };

const manifest = {
  suites: [
    { path: 'apps/a/test/unit/plain.test.ts', type: 'unit', runner: 'bun' },
    {
      path: 'apps/a/test/unit/pinned.test.ts', type: 'unit', runner: 'node', reason: 'why'
    },
    { path: 'apps/a/test/unit/flaky.test.ts', type: 'unit', runner: 'bun' },
    { path: 'apps/a/test/integration/x.test.ts', type: 'integration', runner: 'bun' }
  ],
  quarantine: [{ path: 'apps/a/test/unit/flaky.test.ts', issue: 'JUM-1', reason: 'flaky' }]
};

/**
 * JUM-680 — a suite that names its own script is run by that script.
 *
 * The website's React suites need jsdom and the website's own Jest config.
 * Handing their paths to `bun test` does not run them under a different runner;
 * it fails to run them at all, which is how three of them sat broken while the
 * gate stayed green — they were not in the manifest to begin with.
 */
describe('scripted unit suites (JUM-680)', () => {
  const scripted = {
    suites: [
      { path: 'apps/a/test/unit/plain.test.ts', type: 'unit', runner: 'bun' },
      {
        path: 'apps/jumentix-website/components/X.test.tsx',
        type: 'unit',
        runner: 'bun',
        script: 'website:test:unit'
      },
      {
        path: 'apps/jumentix-website/components/Y.test.tsx',
        type: 'unit',
        runner: 'bun',
        script: 'website:test:unit'
      }
    ],
    quarantine: []
  };

  it('keeps a scripted suite out of the path lists', () => {
    expect.hasAssertions();

    const { bunSuites, nodeSuites, scripts } = partitionUnitSuites(scripted, local);

    expect(bunSuites).toStrictEqual(['apps/a/test/unit/plain.test.ts']);
    expect(nodeSuites).toStrictEqual([]);
    // Two suites, one script: the script runs once, not once per file.
    expect(scripts).toStrictEqual(['website:test:unit']);
  });

  it('runs each script once and gates on its status', () => {
    expect.hasAssertions();

    const calls: string[][] = [];
    const spawn = (cmd: string, args: string[]) => {
      calls.push([cmd, ...args]);
      return { status: 0 } as never;
    };

    expect(runScriptedUnit(['website:test:unit'], { spawn })).toBe(0);
    expect(calls).toStrictEqual([['bun', 'run', 'website:test:unit']]);
  });

  it('fails the gate when a scripted suite fails', () => {
    expect.hasAssertions();

    // The point of mapping them at all. A scripted suite that fails must fail
    // the build, or it is invisible in a second way.
    const spawn = () => ({ status: 1 }) as never;

    expect(runScriptedUnit(['website:test:unit'], { spawn })).toBe(1);
  });

  it('does nothing when no suite declares a script', () => {
    expect.hasAssertions();

    expect(runScriptedUnit([], {})).toBe(0);
  });
});

describe('partitionUnitSuites', () => {
  it('keeps a quarantined suite out of the gating lists', () => {
    expect.hasAssertions();

    const { bunSuites, nodeSuites, reportOnlySuites } = partitionUnitSuites(manifest, ciNode);

    expect(bunSuites).not.toContain('apps/a/test/unit/flaky.test.ts');
    expect(nodeSuites).not.toContain('apps/a/test/unit/flaky.test.ts');
    expect(reportOnlySuites).toStrictEqual(['apps/a/test/unit/flaky.test.ts']);
  });

  it('still routes the unquarantined suites by their runner', () => {
    expect.hasAssertions();

    const { bunSuites, nodeSuites } = partitionUnitSuites(manifest, ciNode);

    expect(bunSuites).toStrictEqual(['apps/a/test/unit/plain.test.ts']);
    expect(nodeSuites).toStrictEqual(['apps/a/test/unit/pinned.test.ts']);
  });

  it('ignores suites that are not unit suites', () => {
    expect.hasAssertions();

    const { bunSuites, nodeSuites, reportOnlySuites } = partitionUnitSuites(manifest, ciNode);
    const everything = [...bunSuites, ...nodeSuites, ...reportOnlySuites];

    expect(everything).not.toContain('apps/a/test/integration/x.test.ts');
  });

  /**
   * Locally there is no Node partition to report through, so a quarantined suite
   * is simply skipped rather than run for an audience of nobody.
   */
  it('does not run a quarantined suite locally', () => {
    expect.hasAssertions();

    const { reportOnlySuites } = partitionUnitSuites(manifest, local);

    expect(reportOnlySuites).toStrictEqual([]);
  });
});

describe('runBunUnit', () => {
  it('resolves workspace packages from source rather than published dist entry points', () => {
    expect.hasAssertions();

    const calls: string[][] = [];
    const status = runBunUnit(['apps/a/test/unit/plain.test.ts'], {
      spawn: (command: string, args: string[]) => {
        calls.push([command, ...args]);
        return { status: 0 } as never;
      }
    });

    expect(status).toBe(0);
    expect(calls).toStrictEqual([[
      'bun', 'test', '--conditions=development', '--isolate', 'apps/a/test/unit/plain.test.ts'
    ]]);
  });
});

describe('runReportOnlyUnit', () => {
  it('spawns nothing when there is nothing quarantined', () => {
    expect.hasAssertions();

    const calls: unknown[] = [];
    const spawn = (...args: unknown[]) => {
      calls.push(args);
      return { status: 0 };
    };

    expect(runReportOnlyUnit([], { spawn })).toBe(0);
    expect(calls).toStrictEqual([]);
  });

  it('reports a failure without withholding it', () => {
    expect.hasAssertions();

    // The status is returned so a caller *could* act on it; the point is that
    // `runUnitTests` deliberately does not.
    const status = runReportOnlyUnit(['apps/a/test/unit/flaky.test.ts'], {
      spawn: () => ({ status: 1 }),
      env: ciNode
    });

    expect(status).toBe(1);
  });
});

describe('runUnitTests', () => {
  /**
   * The assertion the whole change exists for: a quarantined suite that fails
   * must not decide the exit code.
   */
  /** The three runners, replaced so the assertion is about how they compose. */
  function wiring(statuses: { bun?: number; node?: number; reportOnly?: number } = {}) {
    const ran: Record<string, string[]> = {};
    return {
      ran,
      runBunUnit: (suites: string[]) => { ran.bun = suites; return statuses.bun ?? 0; },
      runNodeUnit: (suites: string[]) => { ran.node = suites; return statuses.node ?? 0; },
      runReportOnlyUnit: (suites: string[]) => {
        ran.reportOnly = suites;
        return statuses.reportOnly ?? 0;
      }
    };
  }

  it('passes when only the quarantined suite fails', () => {
    expect.hasAssertions();

    const wired = wiring({ reportOnly: 1 });
    const status = runUnitTests({
      manifest, env: ciNode, root: repoRoot, ...wired
    });

    expect(status).toBe(0);
    // It ran — the quarantine buys relief from the gate, not silence.
    expect(wired.ran.reportOnly).toStrictEqual(['apps/a/test/unit/flaky.test.ts']);
  });

  it('still fails when a gating suite fails', () => {
    expect.hasAssertions();

    expect(runUnitTests({
      manifest, env: ciNode, root: repoRoot, ...wiring({ node: 1 })
    }))
      .toBe(1);
  });

  it('stops at the bun partition rather than reporting a later status', () => {
    expect.hasAssertions();

    const wired = wiring({ bun: 1 });

    expect(runUnitTests({
      manifest, env: ciNode, root: repoRoot, ...wired
    })).toBe(1);
    // A failing bun run short-circuits: the node partition never ran, so its
    // status cannot mask the failure.
    expect(wired.ran.node).toBeUndefined();
  });
});
