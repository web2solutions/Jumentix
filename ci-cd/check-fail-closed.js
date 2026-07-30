/**
 * Fail-closed verification for the Bun toolchain (JUM-38).
 *
 * A gate that has never been observed failing is not a gate — it is a script
 * that happens to exit 0. Requirement 065 forbids false greens, and the whole
 * Bun migration is only acceptable if each gate class still refuses to pass when
 * it should fail.
 *
 * This harness injects a deliberate fault per gate class, asserts a non-zero
 * exit, and restores the tree. It is itself fail-closed: if a fixture cannot be
 * set up or the tree cannot be restored, it exits non-zero rather than skipping.
 *
 * Run: `bun ci-cd/check-fail-closed.js`
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const results = [];

/**
 * Resolve the interpreter the fixtures must run on.
 *
 * `process.execPath` rather than a PATH lookup, so the fixtures execute on the
 * same pinned Bun that is running this harness — and so the spawn carries no
 * PATH-resolution ambiguity.
 *
 * It fails closed when the harness is not itself running under Bun. Without that
 * check `process.execPath` would silently be the Node binary, and every gate
 * would be exercised on the wrong runtime while still reporting eight passes —
 * a false green inside the very harness that exists to prevent them.
 *
 * @param {NodeJS.ProcessVersions} versions
 * @param {string} execPath
 */
function resolveBunBinary(versions = process.versions, execPath = process.execPath) {
  if (!versions.bun) {
    throw new Error(
      'check-fail-closed must run under Bun (Requirement 096 §1). Invoke it with '
        + '`bun ci-cd/check-fail-closed.js`; under Node the fixtures would silently '
        + 'exercise the wrong runtime.',
    );
  }
  return execPath;
}

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ...(options.env || {}) },
    timeout: options.timeoutMs || 600_000,
  });
}

/**
 * @param {string} name gate class under test
 * @param {() => void} inject applies the deliberate fault
 * @param {() => object} probe runs the gate; must return a spawn result
 * @param {() => void} restore undoes the fault
 */
function assertFailsClosed(name, inject, probe, restore) {
  let injected = false;
  try {
    inject();
    injected = true;
    const result = probe();
    const status = typeof result.status === 'number' ? result.status : null;
    const passed = status !== null && status !== 0;
    results.push({ name, status, passed });
    console.log(
      `  ${passed ? 'PASS' : 'FAIL'}  ${name.padEnd(46)} exit=${status === null ? 'signal/timeout' : status}`,
    );
  } catch (error) {
    results.push({ name, status: null, passed: false, error: error.message });
    console.log(`  FAIL  ${name.padEnd(46)} fixture error: ${error.message}`);
  } finally {
    if (injected) {
      try {
        restore();
      } catch (error) {
        // A fixture that cannot be undone leaves the tree corrupt. That is worse
        // than a failed assertion, so it is fatal rather than reported.
        console.error(`\nFATAL: could not restore after "${name}": ${error.message}`);
        process.exit(2);
      }
    }
  }
}

function readFile(relative) {
  return fs.readFileSync(path.join(repoRoot, relative), 'utf8');
}

function writeFile(relative, content) {
  fs.writeFileSync(path.join(repoRoot, relative), content);
}

/**
 * Reduce recorded outcomes to a verdict. Kept pure and exported so the pass/fail
 * accounting is unit-testable without spawning eight subprocesses.
 *
 * @param {{name: string, passed: boolean, status: number|null}[]} entries
 */
function summarize(entries) {
  const failed = entries.filter((entry) => !entry.passed);
  return { total: entries.length, failed, ok: failed.length === 0 };
}

function main() {
  const BUN_BINARY = resolveBunBinary();
  console.log('Fail-closed verification (JUM-38)\n');

// 1. Toolchain guard — a version pin that does not match the running Bun.
assertFailsClosed(
  'toolchain guard rejects a pin mismatch',
  () => writeFile('.bun-version', '0.0.1\n'),
  () => run(BUN_BINARY, ['ci-cd/check-bun-version.js']),
  () => writeFile('.bun-version', '1.3.14\n'),
);

// 2. Dependency override integrity — a dropped security pin.
const packageJsonBackup = readFile('package.json');
assertFailsClosed(
  'override guard rejects a dropped security pin',
  () => {
    const pkg = JSON.parse(packageJsonBackup);
    delete pkg.overrides['form-data'];
    writeFile('package.json', `${JSON.stringify(pkg, null, 2)}\n`);
  },
  () => run(BUN_BINARY, ['ci-cd/check-dependency-override-integrity.js']),
  () => writeFile('package.json', packageJsonBackup),
);

// 3. Override integrity — a reintroduced pnpm nested selector, which npm and Bun
//    both treat as an invalid package name, leaving the pin silently inert.
assertFailsClosed(
  'override guard rejects a pnpm nested selector',
  () => {
    const pkg = JSON.parse(packageJsonBackup);
    pkg.overrides['restify>find-my-way'] = '^9.7.0';
    writeFile('package.json', `${JSON.stringify(pkg, null, 2)}\n`);
  },
  () => run(BUN_BINARY, ['ci-cd/check-dependency-override-integrity.js']),
  () => writeFile('package.json', packageJsonBackup),
);

// 4. Install gate — a lockfile that no longer matches the manifest must not be
//    silently rewritten under --frozen-lockfile.
assertFailsClosed(
  'frozen install rejects manifest/lockfile drift',
  () => {
    const pkg = JSON.parse(packageJsonBackup);
    pkg.devDependencies['left-pad'] = '^1.3.0';
    writeFile('package.json', `${JSON.stringify(pkg, null, 2)}\n`);
  },
  () => run(BUN_BINARY, ['install', '--frozen-lockfile']),
  () => writeFile('package.json', packageJsonBackup),
);

// 5. Typecheck gate — Bun transpiles without typechecking, so `tsc` staying
//    mandatory (Requirement 096 §3) is only meaningful if it still fails.
const typecheckFixture = 'apps/backend-template/src/__fail_closed_fixture__.ts';
assertFailsClosed(
  'tsc rejects a type error',
  () => writeFile(typecheckFixture, 'export const broken: number = "not a number";\n'),
  () => run(BUN_BINARY, ['run', 'build:dev']),
  () => fs.rmSync(path.join(repoRoot, typecheckFixture), { force: true }),
);

// 6. Lint gate.
const lintFixture = 'apps/backend-template/src/__fail_closed_lint__.ts';
assertFailsClosed(
  'ESLint rejects a violation',
  () => writeFile(lintFixture, 'const unused = 1\nexport default function f(){var x=1;return x}\n'),
  () => run(BUN_BINARY, ['run', 'lint']),
  () => fs.rmSync(path.join(repoRoot, lintFixture), { force: true }),
);

// 7. Unit gate — a deliberately failing test must fail the suite. This is the
//    single most important assertion here: it is the one that proves the gate is
//    still connected to the tests at all.
const unitFixture = 'apps/backend-template/test/unit/__fail_closed__.test.ts';
assertFailsClosed(
  'unit gate rejects a failing test',
  () => writeFile(
    unitFixture,
    'describe(\'fail-closed fixture\', () => {\n'
      + '  it(\'must fail\', () => {\n'
      + '    expect.hasAssertions();\n'
      + '    expect(1).toBe(2);\n'
      + '  });\n'
      + '});\n',
  ),
  () => run(BUN_BINARY, ['run', 'test:unit'], { env: { NODE_ENV: 'dev' } }),
  () => fs.rmSync(path.join(repoRoot, unitFixture), { force: true }),
);

// 8. Workspace orchestration — `bun run --filter` must not report success when no
//    package matches. pnpm's `--if-present` exited 0 here, which is precisely the
//    false green this migration removes.
assertFailsClosed(
  'filtered workspace run rejects a missing script',
  () => {},
  () => run(BUN_BINARY, ['run', '--filter', '*', '__fail_closed_missing_script__']),
  () => {},
);

console.log('');
const verdict = summarize(results);
if (!verdict.ok) {
  console.error(`Fail-closed verification FAILED: ${verdict.failed.length} of ${verdict.total} gate class(es) did not fail closed:`);
  for (const entry of verdict.failed) {
    console.error(`  - ${entry.name} (exit=${entry.status}${entry.error ? `, ${entry.error}` : ''})`);
  }
  console.error('\nA gate that passes with a deliberate fault injected is a false green (Req 065).');
  process.exit(1);
}

console.log(`Fail-closed verification passed: ${verdict.total}/${verdict.total} gate classes fail closed.`);
}

if (require.main === module) {
  main();
}

module.exports = { main, resolveBunBinary, summarize };
