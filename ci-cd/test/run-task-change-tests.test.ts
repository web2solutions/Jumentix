/* eslint-disable @typescript-eslint/no-var-requires */
const taskFs = require('fs');
const taskPath = require('path');
const {
  createTaskTestPlan,
  documentationRequiresRegistryCheck,
  executeDocumentationValidation,
  normalizeFiles,
  readChangedFiles,
  runTaskChangeTests,
  validateDocumentationFiles
} = require('../run-task-change-tests');

/**
 * Plan shapes for the outcome-mapping test (JUM-697).
 *
 * They are not invented: each is what `createLayerAwarePlan` returns today for
 * the inputs that test uses — `unsupported-change-set` for a bare unit test,
 * `layer-aware` for a `ci-cd/` change, `documentation-validation` for a `.md`.
 * The first test below calls the real resolver once and asserts the type and
 * keys these stand in for, so a stub that drifts from the resolver fails there
 * rather than quietly keeping the outcome test green.
 *
 * What this removes is cost, not coverage. Resolving the real plan reads
 * `test-map.json` and walks the tree; doing that four times to assert four
 * outcome strings is what pushed this test past a 5-second timeout.
 */
function planFor(type: string) {
  return (files: string[]) => ({
    type,
    files,
    selectedLayers: type === 'layer-aware' ? ['tooling'] : [],
    notRunLayers: [],
    reasons: [],
    unitSuites: [],
    integrationScripts: [],
    suites: []
  });
}

describe('run-task-change-tests', () => {
  it('keeps the stubbed plan shapes honest against the real resolver (JUM-697)', () => {
    expect.hasAssertions();

    // One real resolution, not four: enough to catch the resolver changing its
    // type strings or its shape under the stubs, without paying the cost per
    // assertion in the outcome test.
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const { createLayerAwarePlan } = require('../lib/layer-resolver');
    const real = createLayerAwarePlan(['ci-cd/example.js'], {});
    const stub = planFor('layer-aware')(['ci-cd/example.js']);

    expect(real.type).toBe(stub.type);
    expect(real.selectedLayers).toStrictEqual(stub.selectedLayers);
    expect(Object.keys(stub).every((key) => key in real)).toBe(true);
  });

  it('normalizes unique changed file paths', () => {
    expect.hasAssertions();
    expect(normalizeFiles(['apps\\backend-template\\src\\a.ts', 'apps/backend-template/src/a.ts', '']))
      .toStrictEqual(['apps/backend-template/src/a.ts']);
  });

  it('reads staged and range diffs using explicit git commands', () => {
    expect.hasAssertions();
    const spawn = jest.fn().mockReturnValue({ status: 0, stdout: 'a.ts\nb.ts\n' });

    expect(readChangedFiles({ mode: 'staged', spawn })).toStrictEqual(['a.ts', 'b.ts']);
    expect(readChangedFiles({ mode: 'range', baseRef: 'origin/dev', spawn })).toStrictEqual(['a.ts', 'b.ts']);
    expect(spawn.mock.calls[0][1]).toContain('--cached');
    expect(spawn.mock.calls[1][1]).toContain('origin/dev...HEAD');
  });

  it('fails when git cannot provide changed files', () => {
    expect.hasAssertions();
    expect(() => readChangedFiles({ spawn: () => ({ status: 1 }) }))
      .toThrow('Unable to read changed files');
  });

  it('runs only changed unit tests when they are present', () => {
    expect.hasAssertions();
    expect(createTaskTestPlan([
      'apps/backend-template/src/example.ts',
      'apps/backend-template/test/unit/example.test.ts'
    ])).toStrictEqual({
      type: 'changed-unit-tests',
      files: ['apps/backend-template/test/unit/example.test.ts']
    });
  });

  it('finds tests related to changed implementation files', () => {
    expect.hasAssertions();
    expect(createTaskTestPlan(['ci-cd/run-task-change-tests.js'])).toStrictEqual({
      type: 'related-unit-tests',
      files: ['ci-cd/run-task-change-tests.js']
    });
  });

  it('runs changed integration and planner tests with Restify timeout headroom', () => {
    expect.hasAssertions();
    expect(createTaskTestPlan([
      'apps/backend-template/test/helpers/listenForSupertest.ts',
      'apps/backend-template/test/integration/Fastify/auth/login.test.ts',
      'apps/backend-template/test/integration/Restify/auth/login.test.ts',
      'ci-cd/test/run-task-change-tests.test.ts'
    ])).toStrictEqual({
      type: 'changed-integration-tests',
      files: [
        'ci-cd/test/run-task-change-tests.test.ts',
        'apps/backend-template/test/integration/Fastify/auth/login.test.ts',
        'apps/backend-template/test/integration/Restify/auth/login.test.ts'
      ],
      testTimeoutMs: 15000
    });
  });

  it('selects website-native gates and preserves other related test inputs', () => {
    expect.hasAssertions();
    expect(createTaskTestPlan([
      'apps/jumentix-website/app/page.tsx',
      'apps/jumentix-website/scripts/prepublish-site-checks.mjs',
      'ci-cd/run-task-change-tests.js',
      'ci-cd/test/run-task-change-tests.test.ts'
    ])).toStrictEqual({
      type: 'website-quality-gate',
      files: [
        'apps/jumentix-website/app/page.tsx',
        'apps/jumentix-website/scripts/prepublish-site-checks.mjs'
      ],
      unitTests: ['ci-cd/test/run-task-change-tests.test.ts'],
      relatedFiles: ['ci-cd/run-task-change-tests.js']
    });
  });

  it('maps CI config and hook changes to their governance unit test', () => {
    expect.hasAssertions();
    expect(createTaskTestPlan([
      '.github/dependabot.yml',
      '.github/workflows/ci.yml',
      '.circleci/config.yml',
      '.husky/pre-push'
    ])).toStrictEqual({
      type: 'mapped-unit-tests',
      files: ['ci-cd/test/run-full-test-matrix.test.ts']
    });
  });

  it('maps Bun lockfile changes to focused toolchain tests even with generated changelog drift', () => {
    expect.hasAssertions();
    expect(createTaskTestPlan(['bun.lock', 'CHANGELOG.md'])).toStrictEqual({
      type: 'mapped-unit-tests',
      files: [
        'ci-cd/test/check-bun-version.test.ts',
        'ci-cd/test/check-dependency-override-integrity.test.ts'
      ]
    });
  });

  it('selects real documentation validation for docs-only changes', () => {
    expect.hasAssertions();
    expect(createTaskTestPlan(['documentation/md/TESTING-CI-AND-QUALITY.md'])).toStrictEqual({
      type: 'documentation-validation',
      files: ['documentation/md/TESTING-CI-AND-QUALITY.md']
    });
  });

  it('fails closed for an unsupported or empty change set', () => {
    expect.hasAssertions();
    expect(createTaskTestPlan([])).toStrictEqual({
      type: 'unsupported-change-set',
      files: []
    });
  });

  it('validates documentation content and conflict markers', () => {
    expect.hasAssertions();
    const rootDir = taskFs.mkdtempSync(taskPath.join(require('os').tmpdir(), 'task-docs-'));
    taskFs.writeFileSync(taskPath.join(rootDir, 'valid.md'), '# Valid\n');
    taskFs.writeFileSync(taskPath.join(rootDir, 'conflict.md'), '<<<<<<< HEAD\n');
    expect(validateDocumentationFiles(['valid.md'], rootDir)).toBe(0);
    expect(validateDocumentationFiles(['missing.md'], rootDir)).toBe(1);
    expect(validateDocumentationFiles(['conflict.md'], rootDir)).toBe(1);
    taskFs.rmSync(rootDir, { recursive: true, force: true });
  });

  it('runs the requirements registry check for requirement documentation changes', () => {
    expect.hasAssertions();
    const rootDir = taskFs.mkdtempSync(taskPath.join(require('os').tmpdir(), 'task-docs-'));
    taskFs.mkdirSync(taskPath.join(rootDir, '.agents/requirements/project'), { recursive: true });
    taskFs.writeFileSync(
      taskPath.join(rootDir, '.agents/requirements/project/999-example.md'),
      '# Requirement 999\n'
    );
    const spawn = jest.fn().mockReturnValue({ status: 0 });

    expect(documentationRequiresRegistryCheck(['.agents/requirements/project/999-example.md']))
      .toBe(true);
    expect(executeDocumentationValidation(['.agents/requirements/project/999-example.md'], {
      rootDir,
      spawn
    })).toBe(0);
    expect(spawn).toHaveBeenCalledWith('bun', ['run', 'requirements:check'], expect.any(Object));
    taskFs.rmSync(rootDir, { recursive: true, force: true });
  });

  it('does not run the requirements registry check for ordinary docs-only changes', () => {
    expect.hasAssertions();
    const rootDir = taskFs.mkdtempSync(taskPath.join(require('os').tmpdir(), 'task-docs-'));
    taskFs.mkdirSync(taskPath.join(rootDir, 'documentation/md'), { recursive: true });
    taskFs.writeFileSync(taskPath.join(rootDir, 'documentation/md/ordinary.md'), '# Ordinary\n');
    const spawn = jest.fn().mockReturnValue({ status: 0 });

    expect(executeDocumentationValidation(['documentation/md/ordinary.md'], { rootDir, spawn }))
      .toBe(0);
    expect(spawn).not.toHaveBeenCalled();
    taskFs.rmSync(rootDir, { recursive: true, force: true });
  });

  /**
   * JUM-682: this needs longer than the 5s default, and it is a bound rather
   * than an assertion.
   *
   * `execute` is injected, so nothing is spawned — but each of the four calls
   * resolves the layer-aware plan against the real repository, and that grew
   * with the manifest. It was already failing on `dev` at 6.1s before this
   * branch touched anything.
   *
   * The timeout buys room; it does not fix the cost. The plan resolution should
   * be injectable so this suite stops reading the whole repository four times —
   * recorded as JUM-697.
   */
  it('records success, failure, crash, and documentation not-applicable evidence', () => {
    expect.hasAssertions();
    const logger = { log: jest.fn(), error: jest.fn() };
    const successful = runTaskChangeTests({
      files: ['apps/backend-template/test/unit/example.test.ts'],
      resolvePlan: planFor('unsupported-change-set'),
      execute: jest.fn().mockReturnValue(0),
      logger,
      resultFile: ''
    });
    const failed = runTaskChangeTests({
      files: ['ci-cd/example.js'],
      resolvePlan: planFor('layer-aware'),
      execute: () => 3,
      logger,
      resultFile: ''
    });
    const crashed = runTaskChangeTests({
      files: ['ci-cd/example.js'],
      resolvePlan: planFor('layer-aware'),
      execute: () => { throw new Error('deliberate failure'); },
      logger,
      resultFile: ''
    });
    const documentation = runTaskChangeTests({
      files: ['README.md'],
      resolvePlan: planFor('documentation-validation'),
      execute: () => 0,
      logger,
      resultFile: ''
    });

    expect(successful.outcome).toBe('passed');
    expect(failed.outcome).toBe('failed');
    expect(crashed.outcome).toBe('failed');
    expect(documentation).toMatchObject({
      plan: 'documentation-validation', outcome: 'not-applicable', status: 0
    });
    expect(logger.error).toHaveBeenCalledTimes(2);
    // The 30s bound this carried is gone: nothing here reads the repository
    // any more, so the default is ample (JUM-697).
  });

  it('keeps Storybook outside the global task-change executor', () => {
    expect.hasAssertions();
    const source = taskFs.readFileSync(
      taskPath.join(__dirname, '../run-task-change-tests.js'),
      'utf8'
    );

    expect(source).not.toContain('\'storybook:build\'');
    expect(source).not.toContain('\'storybook:smoke\'');
    expect(source).toContain('\'test:prepublish\'');
  });

  it('writes JSON evidence for the selected change-focused test plan', () => {
    expect.hasAssertions();
    const resultFile = taskPath.join(__dirname, '.tmp-task-change-evidence.json');
    const evidence = runTaskChangeTests({
      files: ['apps/backend-template/test/unit/example.test.ts'],
      execute: () => 0,
      logger: { log: jest.fn(), error: jest.fn() },
      resultFile
    });

    expect(JSON.parse(taskFs.readFileSync(resultFile, 'utf8'))).toStrictEqual(evidence);
    taskFs.unlinkSync(resultFile);
  });
});

/**
 * Evidence bookkeeping for integration suites.
 *
 * The plan lists integration suites by path; execution runs them through one npm
 * script per framework. Recording only the script name left `validateGateEvidence`
 * comparing paths against script names, so every planned integration suite
 * reported as "missing from executed set".
 *
 * That is a fail-closed gate failing on its own accounting rather than on a test,
 * and it stayed invisible for as long as no change selected an integration layer.
 * The Express 5 upgrade selected them and forty-odd suites were reported unrun
 * immediately after passing.
 */
describe('layer-aware evidence for integration scripts', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
  const taskRunner = require('../run-task-change-tests');
  // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
  const { buildGateEvidence, validateGateEvidence } = require('../lib/gate-evidence');

  const planWith = (script: string) => ({
    type: 'layer-aware',
    files: ['apps/backend-template/src/interface/HTTP/adapters/express/ExpressServer.ts'],
    selectedLayers: ['adapters/in'],
    notRunLayers: [],
    reasons: {},
    unitSuites: [],
    integrationScripts: [script],
    suites: [
      {
        path: 'apps/backend-template/test/integration/Express/Users/create.test.ts',
        type: 'integration',
        script
      },
      {
        path: 'apps/backend-template/test/integration/Express/auth/login.test.ts',
        type: 'integration',
        script
      }
    ]
  });

  it('records the suite files a script covers, not just the script name', () => {
    expect.hasAssertions();
    const plan = planWith('test:integration:express') as never;

    taskRunner.executeLayerAwarePlan(plan, {
      spawn: () => ({ status: 0 })
    });

    expect((plan as { _execution: { executedSuites: string[] } })._execution.executedSuites)
      .toStrictEqual([
        'test:integration:express',
        'apps/backend-template/test/integration/Express/Users/create.test.ts',
        'apps/backend-template/test/integration/Express/auth/login.test.ts'
      ]);
  });

  it('produces evidence that validates, rather than reporting its own suites unrun', () => {
    expect.hasAssertions();
    // The assertion that actually matters: the gate must accept its own output.
    const plan = planWith('test:integration:express') as never;

    taskRunner.executeLayerAwarePlan(plan, { spawn: () => ({ status: 0 }) });
    const execution = (plan as { _execution: unknown })._execution;
    const evidence = buildGateEvidence(
      { ...(plan as object), outcome: 'passed' },
      { ...(execution as object), outcome: 'passed' }
    );

    const validation = validateGateEvidence(evidence) as { ok: boolean; errors: string[] };

    expect(validation.errors).toStrictEqual([]);
    expect(validation.ok).toBe(true);
  });

  it('runs and records contract suites selected through the contracts layer (JUM-474)', () => {
    expect.hasAssertions();
    // Editing `ci-cd/check-oas-route-resolution.js` selects the contracts
    // layer; the planned contract suites must be executed via their scripts
    // and recorded by path, or the evidence validation fails closed on its
    // own bookkeeping — exactly the integration-suite gap above.
    const spawned: string[] = [];
    const plan = {
      type: 'layer-aware',
      files: ['ci-cd/check-oas-route-resolution.js'],
      selectedLayers: ['contracts', 'tooling'],
      notRunLayers: [],
      reasons: {},
      unitSuites: [],
      integrationScripts: ['oas:check-routes'],
      suites: [
        {
          path: 'ci-cd/check-oas-route-resolution.js',
          type: 'contract',
          script: 'oas:check-routes'
        }
      ]
    } as never;

    taskRunner.executeLayerAwarePlan(plan, {
      spawn: (_cmd: string, args: string[]) => {
        spawned.push(args[1]);
        return { status: 0 };
      }
    });

    expect(spawned).toStrictEqual(['oas:check-routes']);
    expect((plan as { _execution: { executedSuites: string[] } })._execution.executedSuites)
      .toStrictEqual(['oas:check-routes', 'ci-cd/check-oas-route-resolution.js']);

    const execution = (plan as { _execution: unknown })._execution;
    const evidence = buildGateEvidence(
      { ...(plan as object), outcome: 'passed' },
      { ...(execution as object), outcome: 'passed' }
    );
    expect(validateGateEvidence(evidence)).toStrictEqual({ ok: true, errors: [] });
  });
});

/**
 * Suite paths arrive from `process.argv` and are handed to a spawned process.
 *
 * The spawn uses an argument array rather than a shell, so there is nothing to
 * escape from today — but "no shell" is a property of one file, not of its
 * callers, and a path that leaves the repository is wrong long before it is
 * dangerous: it would run someone else's tests and report them as this suite's.
 */
describe('suite path validation', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
  const { invalidSuitePaths } = require('../run-suite') as {
    invalidSuitePaths: (paths: unknown[], root?: string) => unknown[];
  };

  const root = '/repo';

  it('accepts a relative path inside the repository', () => {
    expect.hasAssertions();
    expect(invalidSuitePaths(['apps/backend-template/test/unit/x.test.ts'], root))
      .toStrictEqual([]);
  });

  it.each([
    ['an absolute path', '/etc/passwd'],
    ['a traversal', '../../etc/passwd'],
    ['a command separator', 'a.test.ts; rm -rf /'],
    ['a substitution', 'a.test.ts$(whoami)'],
    ['a backtick', 'a.test.ts`id`'],
    ['a newline', 'a.test.ts\nrm -rf /'],
    ['an empty string', '']
  ])('rejects %s', (_case, given) => {
    expect.hasAssertions();
    expect(invalidSuitePaths([given], root)).toStrictEqual([given]);
  });

  it('rejects a non-string rather than coercing it', () => {
    expect.hasAssertions();
    // `String(undefined)` would become the path "undefined", which resolves
    // inside the repo and would be handed to the runner.
    expect(invalidSuitePaths([undefined, 42], root)).toStrictEqual([undefined, 42]);
  });

  it('names every rejected path, not just the first', () => {
    expect.hasAssertions();
    // The message is the whole diagnosis; reporting one of three would send
    // someone round the loop twice.
    expect(invalidSuitePaths(['ok/a.test.ts', '/etc/passwd', '../b.test.ts'], root))
      .toStrictEqual(['/etc/passwd', '../b.test.ts']);
  });
});

/**
 * What is actually handed to the spawn.
 *
 * `invalidSuitePaths` decides *whether* a path is acceptable; this decides what
 * runs. Passing the argv strings straight through works, but then the value that
 * was validated and the value that is executed are the same object — so a later
 * edit that moves the check, or adds a path after it, silently stops being
 * covered.
 */
describe('suite path canonicalisation', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
  const { canonicalSuitePaths } = require('../run-suite') as {
    canonicalSuitePaths: (paths: string[], root?: string) => string[];
  };

  const root = '/repo';

  it('leaves an already-canonical path alone', () => {
    expect.hasAssertions();
    expect(canonicalSuitePaths(['apps/x/test/a.test.ts'], root))
      .toStrictEqual(['apps/x/test/a.test.ts']);
  });

  it('collapses a path that walks back through itself', () => {
    expect.hasAssertions();
    expect(canonicalSuitePaths(['apps/./x/../x/test/a.test.ts'], root))
      .toStrictEqual(['apps/x/test/a.test.ts']);
  });

  it('returns paths relative to the repository root', () => {
    expect.hasAssertions();
    // The runner is invoked from the root, so a relative path is what it expects.
    expect(canonicalSuitePaths(['/repo/apps/x/a.test.ts'], root))
      .toStrictEqual(['apps/x/a.test.ts']);
  });
});
