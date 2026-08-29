/* eslint-disable @typescript-eslint/no-var-requires */
const guardDefaultsPath = require('path');
const guardDefaultsFs = require('fs');
const guardDefaultsOs = require('os');

/**
 * The guards called the way CI calls them: with no injection at all (JUM-681).
 *
 * Every other suite passes `spawn`, `readTestMap`, `execute` and friends, which
 * is what makes those suites fast and deterministic — and it means the default
 * side of each seam (`options.spawn || spawnSync`, `env = process.env`,
 * `options.root || process.cwd()`) is never executed. That half is not
 * decoration: it is the wiring CI actually runs, and until now nothing here
 * proved the two halves agree.
 *
 * These call the real thing. They spawn real `bun run` processes, read the real
 * `test-map.json` and shell out to the real `git`, which is slower than a double
 * and is the point: an injected spawn cannot catch a default that resolves to
 * the wrong binary, and an injected map cannot catch a resolver that reads the
 * wrong file.
 *
 * Kept cheap on purpose: the scripts chosen are the ones that do nothing
 * expensive (`check-bun-version`), and the paths are real suites that already
 * exist in the map.
 */
const guardDefaultsMatrix = require('../../../../../ci-cd/run-full-test-matrix');
const guardDefaultsSuiteRunner = require('../../../../../ci-cd/run-suite');
const guardDefaultsCoverage = require('../../../../../ci-cd/check-coverage-thresholds');
const guardDefaultsOverrides = require('../../../../../ci-cd/check-dependency-override-integrity');
const guardDefaultsAuthorship = require('../../../../../ci-cd/check-commit-authorship');
const guardDefaultsPackageSuites = require('../../../../../ci-cd/check-package-suites');
const guardDefaultsToolchain = require('../../../../../ci-cd/check-bun-version');

const guardDefaultsRepoRoot = guardDefaultsPath.resolve(__dirname, '../../../../..');

describe('ci-cd guards, no injection (JUM-681)', () => {
  it('spawns a real script and returns its exit status', () => {
    expect.hasAssertions();

    // `executeMatrixCell` with its own `spawnSync`: the pinned-toolchain guard
    // is the cheapest script in the manifest and answers 0 on a healthy tree.
    expect(guardDefaultsMatrix.executeMatrixCell({ id: 'version', script: 'check-bun-version' })).toBe(0);

    // And a script that does not exist must not be read as success.
    expect(guardDefaultsMatrix.executeMatrixCell({ id: 'missing', script: 'no:such:script' })).not.toBe(0);
  });

  it('passes a cell environment through to the child', () => {
    expect.hasAssertions();

    // `cell.env` is how a cell asks for a different runtime or a skip list. It
    // is merged over `process.env` inside the real spawn, so a cell that
    // declares one and never gets it would run the wrong configuration and
    // still report the exit status of the run it did do.
    expect(guardDefaultsMatrix.executeMatrixCell({
      id: 'version',
      script: 'check-bun-version',
      env: { JUMENTIX_MATRIX_CELL: 'jum681' }
    })).toBe(0);
  });

  it('runs the matrix with every option defaulted', () => {
    expect.hasAssertions();

    // No execute, no logger, no scripts table, no result file: the defaults CI
    // relies on, over the one cell cheap enough to actually run. The default
    // `execute` spawns it for real, so this also proves the manifest validation
    // reads the real `package.json` scripts.
    //
    // `env` is the one option passed, and empty on purpose: CI sets
    // `JUMENTIX_FULL_MATRIX_SKIP_CELLS` for the cells it splits across jobs, and
    // a skip list naming a cell absent from this one-cell manifest is — rightly
    // — an error. The default `env` is exercised by the skip-list test below,
    // which reads the real one.
    const evidence = guardDefaultsMatrix.runFullTestMatrix({
      cells: [{ id: 'version', script: 'check-bun-version' }],
      env: {}
    });

    expect(evidence).toStrictEqual({
      schemaVersion: 1,
      outcome: 'passed',
      requiredCellCount: 1,
      reportedCellCount: 1,
      results: [{
        id: 'version', script: 'check-bun-version', state: 'passed', status: 0
      }]
    });
  });

  it('reads the skip list from the real environment when none is passed', () => {
    expect.hasAssertions();

    // No `env` argument: the default is `process.env`. On a developer machine
    // that carries no skip list and every cell survives; on CI it carries the
    // split this job is part of, and the cells it names are removed. Asserting
    // the subset rather than equality is what makes this true in both places
    // without the test deciding which one it is running in.
    const resolved = guardDefaultsMatrix.resolveMatrixCells(guardDefaultsMatrix.FULL_TEST_MATRIX);
    const declaredIds = guardDefaultsMatrix.FULL_TEST_MATRIX.map((cell: { id: string }) => cell.id);

    expect(guardDefaultsMatrix.FULL_TEST_MATRIX.length).toBeGreaterThan(0);
    expect(resolved.length).toBeLessThanOrEqual(guardDefaultsMatrix.FULL_TEST_MATRIX.length);
    expect(declaredIds).toStrictEqual(expect.arrayContaining(
      resolved.map((cell: { id: string }) => cell.id)
    ));
  });

  it('validates the real matrix against the real package.json', () => {
    expect.hasAssertions();

    // Both defaults at once: the manifest CI runs, checked against the scripts
    // that actually exist. A renamed script fails here without any fixture.
    expect(() => guardDefaultsMatrix.validateMatrixManifest(
      guardDefaultsMatrix.FULL_TEST_MATRIX,
      require('../../../../../package.json').scripts
    )).not.toThrow();
  });

  it('resolves suite paths against the real test map', () => {
    expect.hasAssertions();

    // No `readTestMap`, no `listTestFiles`, no `root`: the resolver reads
    // `test-map.json` from disk and walks the tree, which is what the runner
    // does for every gate invocation.
    const resolved = guardDefaultsSuiteRunner.resolveMappedSuitePaths([
      'apps/backend-template/test/unit/ci-cd'
    ]);

    expect(resolved.resolved.length).toBeGreaterThan(5);
    expect(resolved.unmatched).toStrictEqual([]);
    expect(resolved.unmapped).toStrictEqual([]);
  });

  it('canonicalises against the real working directory', () => {
    expect.hasAssertions();

    expect(guardDefaultsSuiteRunner.canonicalSuitePaths(['ci-cd/./run-suite.js']))
      .toStrictEqual(['ci-cd/run-suite.js']);
  });

  it('reads the real map when asked whether a path is pinned to node', () => {
    expect.hasAssertions();

    // The default `readTestMap`, against the manifest as it stands today.
    expect(guardDefaultsSuiteRunner.mapPinsToNode(['apps/backend-template/test/unit/ci-cd']))
      .toStrictEqual(expect.any(Boolean));
  });

  it('spawns the real runner for a real suite', () => {
    expect.hasAssertions();

    // No `spawn`: `runSuitePaths` uses `spawnSync` and actually executes a
    // suite. This one is small and has no external dependency.
    const status = guardDefaultsSuiteRunner.runSuitePaths(
      ['packages/mutex-service/test/ServiceResponse.test.ts'],
      { label: 'jum681-defaults' }
    );

    expect(status).toBe(0);
  }, 120_000);

  // `defaultReadReport` is deliberately NOT called here. It reads
  // `coverage/coverage-final.json`, which the run measuring this very suite is
  // writing — so the branch it takes depends on whether a previous report was
  // left on disk, and the branch count moved by three between two identical
  // runs because of it. A gate whose floor drifts is a gate that fails at
  // random (Requirement 134). The reader is covered with an injected path in
  // `check-coverage-thresholds.test.ts`, where it is deterministic.
  it('validates coverage against the real thresholds and exceptions', () => {
    expect.hasAssertions();

    // No thresholds and no exception register passed: both defaults, which is
    // how the CLI runs it.
    const perfect = {
      statements: { found: 100, hit: 100 },
      lines: { found: 100, hit: 100 },
      functions: { found: 100, hit: 100 },
      branches: { found: 100, hit: 100 }
    };

    const { failures } = guardDefaultsCoverage.validateCoverage(perfect);

    expect(failures).toStrictEqual([]);
  });

  it('checks the real manifest for override integrity', () => {
    expect.hasAssertions();

    // Default `retiredSurfacesPresent` and default `patchExists`: the second
    // resolves patch files from disk, so a declared patch that was deleted
    // fails here without a fixture.
    const failures = guardDefaultsOverrides.validateOverrideIntegrity(
      require('../../../../../package.json')
    );

    expect(failures).toStrictEqual([]);
  });

  it('detects retired package-manager surfaces against the real tree', () => {
    expect.hasAssertions();

    // Default root: the repository itself, which must carry none of them.
    expect(guardDefaultsOverrides.detectRetiredSurfaces()).toStrictEqual([]);
  });

  it('reads the installed dependent range from the real node_modules', () => {
    expect.hasAssertions();

    const [pair] = guardDefaultsOverrides.OVERRIDE_MAJOR_COMPATIBILITY;
    const range = guardDefaultsOverrides.readInstalledDependentRange(
      pair.dependent,
      pair.overridden
    );

    // Express declares `send`, and the guard must read it from disk rather than
    // from a table that can go stale.
    expect(['string', 'object']).toContain(typeof range);
  });

  it('reads a range of null for a dependent that is not installed', () => {
    expect.hasAssertions();

    // `require.resolve` throws for a package that is not there. Answering null
    // rather than throwing is what lets the guard report "no longer depends on"
    // as a failure instead of crashing the whole check.
    expect(guardDefaultsOverrides.readInstalledDependentRange('jum681-not-a-package', 'send')).toBeNull();
  });

  it('checks major compatibility against a manifest with no overrides at all', () => {
    expect.hasAssertions();

    // Both defaults: no `overrides` key, and the real installed-tree reader. A
    // manifest that declares no overrides has no pairs to violate.
    expect(guardDefaultsOverrides.validateOverrideMajors({})).toStrictEqual([]);
  });

  it('checks package suites against the real tree with no options', () => {
    expect.hasAssertions();

    // Default root, default register, default reader: the guard walks this
    // repository's packages and reads their manifests from disk.
    const result = guardDefaultsPackageSuites.run();

    expect(result.ok).toBe(true);
    expect(result.message).toContain('Package suite check passed');
  });

  it('reports the package-suite result through the default console and runner', () => {
    expect.hasAssertions();

    // `main` with neither an io nor an execute: the exit code CI reads comes
    // from the same pair of defaults.
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);

    const code = guardDefaultsPackageSuites.main();

    log.mockRestore();

    expect(code).toBe(0);
  });

  it('runs the real git history check', () => {
    expect.hasAssertions();

    // `run` with its own `runGit`: `execFileSync` against the absolute git
    // binary, over this repository's commits.
    const result = guardDefaultsAuthorship.run();

    expect(typeof result.ok).toBe('boolean');
    expect(typeof result.message).toBe('string');
  }, 120_000);

  it('reads the real declaration file', () => {
    expect.hasAssertions();

    const declaration = guardDefaultsFs.readFileSync(
      guardDefaultsPath.join(guardDefaultsRepoRoot, guardDefaultsAuthorship.DECLARATION_PATH),
      'utf8'
    );

    const parsed = guardDefaultsAuthorship.parseDeclaration(declaration);

    // The declaration the gate enforces, read from disk rather than restated in
    // a fixture: an empty list here would authorise nobody and pass every commit
    // that the cutoff excludes.
    expect(parsed.emails.size).toBeGreaterThan(0);
    expect(typeof parsed.cutoff).toBe('string');
  });

  it('runs the guardDefaultsAuthorship CLI over the real history and the real identity', () => {
    expect.hasAssertions();

    // `main` with its default argv handling and both checks reachable. The exit
    // code is the whole contract — a guard that reports a failure and returns 0
    // blocks nothing — so both outcomes are driven rather than hoped for.
    //
    // The checks themselves are scripted here, and the real ones run in the two
    // tests above. On CI this file runs over a checkout whose git identity is
    // the runner's, so asserting a specific exit code from the real identity
    // check would be asserting the runner's configuration.
    const io = { log: jest.fn(), error: jest.fn() };

    const history = guardDefaultsAuthorship.main([], io, { run: () => ({ ok: true, message: 'clean' }) });
    const identity = guardDefaultsAuthorship.main(['--identity'], io, {
      checkConfiguredIdentity: () => ({ ok: false, message: 'unauthorized identity' })
    });

    expect(history).toBe(0);
    expect(identity).toBe(1);
    expect(io.error).toHaveBeenCalledWith('unauthorized identity');
  }, 120_000);

  it('writes guardDefaultsMatrix evidence to a real path', () => {
    expect.hasAssertions();

    const root = guardDefaultsFs.mkdtempSync(
      guardDefaultsPath.join(guardDefaultsOs.tmpdir(), 'jum681-defaults-')
    );
    const target = guardDefaultsPath.join(root, 'evidence.json');

    guardDefaultsMatrix.writeMatrixEvidence({ outcome: 'passed' }, target);

    expect(JSON.parse(guardDefaultsFs.readFileSync(target, 'utf8')))
      .toStrictEqual({ outcome: 'passed' });

    guardDefaultsFs.rmSync(root, { recursive: true, force: true });
  });

  it('reads the toolchain facts from the real process and the real pin file', () => {
    expect.hasAssertions();

    // The inputs the guard judges, taken from where CI takes them: the running
    // runtime, `.bun-version` on disk, and `packageManager` in the manifest. An
    // injected fixture cannot catch a pin file that moved.
    const input = guardDefaultsToolchain.readToolchainInput();

    expect(String(input.rawPin).trim()).toMatch(/^\d+\.\d+\.\d+$/);
    expect(input.declaredPackageManager).toContain('bun@');
  });

  it('refuses to pass when the runtime is not the pinned Bun', () => {
    expect.hasAssertions();

    // Keep this path deterministic regardless of the Bun version running the
    // suite: the no-argument/default path is covered above, while this case
    // proves the refusal logic with an explicit mismatch.
    const exit = jest.spyOn(process, 'exit').mockImplementation(((code: number): never => {
      throw new Error(`exit:${String(code)}`);
    }) as never);
    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    const raised = (() => {
      try {
        guardDefaultsToolchain.main({
          ...guardDefaultsToolchain.readToolchainInput(),
          runningBunVersion: '0.0.0'
        });
        return null;
      } catch (thrown) {
        return thrown as Error;
      }
    })();
    const reported = error.mock.calls.map((call) => String(call[0])).join('\n');

    exit.mockRestore();
    error.mockRestore();

    expect(raised?.message).toBe('exit:1');
    expect(reported).toContain('Bun toolchain guard failed');
  });

  it('reports through one channel and exits accordingly, with no options injected', () => {
    expect.hasAssertions();

    // `main` with only an io: the argv default and both check defaults, which is
    // the shape the `bin` entry runs. What is asserted is the contract that
    // holds whatever this checkout's history looks like — the guard reports on
    // exactly one channel, and the exit code agrees with the channel it chose.
    // A guard that logged a failure and returned 0 would block nothing.
    const io = { log: jest.fn(), error: jest.fn() };

    const code = guardDefaultsAuthorship.main([], io);
    const channels = { failures: io.error.mock.calls.length, successes: io.log.mock.calls.length };

    // One message, on the channel the exit code names: [1, 0] for a refusal,
    // [0, 1] for a pass. Anything else is a guard whose report and whose exit
    // code disagree.
    expect([[1, 0], [0, 1]]).toContainEqual([channels.failures, channels.successes]);
    expect([[1, 1], [0, 0]]).toContainEqual([code, channels.failures]);
  }, 120_000);
});
