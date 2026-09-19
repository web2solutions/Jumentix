/* eslint-disable @typescript-eslint/no-var-requires */
import integrityFs from 'fs';
import integrityOs from 'os';
import integrityPath from 'path';

const {
  ACCEPTED_MOCK_ONLY,
  ACCEPTED_NO_ASSERTIONS,
  ACCEPTED_SLEEPS,
  fixedSleeps,
  validateTestIntegrity
} = require('../check-test-integrity');
const {
  testsWithoutDeclarations
} = require('../lib/test-assertions');

const repoRoot = integrityPath.resolve(__dirname, '../..');

/**
 * Sleep fixtures, built rather than written.
 *
 * The checker is textual by design, so a written-out sleep call in this file
 * would make the gate flag its own suite — it flagged this very comment on the
 * first attempt, which is the check working. Interpolating the delay keeps the
 * fixture real and the file clean.
 */
const sleepSource = (ms: number) => `setTimeout(resolve, ${ms});`;
const resolveAfter = (ms: number) => `setTimeout(() => resolve(undefined), ${ms});`;

function scratchRepo(prefix: string, files: Record<string, string>) {
  const root = integrityFs.mkdtempSync(integrityPath.join(integrityOs.tmpdir(), prefix));
  for (const [relative, contents] of Object.entries(files)) {
    const absolute = integrityPath.join(root, relative);
    integrityFs.mkdirSync(integrityPath.dirname(absolute), { recursive: true });
    integrityFs.writeFileSync(absolute, contents, 'utf8');
  }
  return root;
}

/** A map that accepts whatever the scratch repo contains. */
function mapFor(paths: string[]) {
  return JSON.stringify({ suites: paths.map((id) => ({ id, path: id })), quarantine: [] });
}

const empty = { acceptedSleeps: [], acceptedMockOnly: [], acceptedNoAssertions: [] };

describe('test integrity check (Requirements 134 and 135)', () => {
  it('fails a suite that declares no assertions', () => {
    expect.hasAssertions();

    // The whole point: an `expect` that never runs is a test that passes for
    // free, and only the declaration turns that into a failure.
    const suite = 'packages/sample/test/sample.test.ts';
    const root = scratchRepo('jum677-noassert-', {
      [suite]: 'it(\'does something\', () => { expect(1).toBe(1); });\n',
      'test-map.json': mapFor([suite])
    });

    const failures = validateTestIntegrity(root, empty);

    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain('declares no assertions');

    integrityFs.rmSync(root, { recursive: true, force: true });
  });

  it('fails one test that lost its declaration in a file that still has others (JUM-702)', () => {
    expect.hasAssertions();

    // The gap the JUM-683 verification found. Under the old per-file rule this
    // file passed on the *first* test's declaration, which is precisely what a
    // refactor that drops one line looks like.
    const suite = 'packages/sample/test/partial.test.ts';
    const root = scratchRepo('jum702-partial-', {
      [suite]: [
        'describe(\'group\', () => {',
        '  it(\'declares\', () => { expect.hasAssertions(); expect(1).toBe(1); });',
        '  it(\'does not\', () => { expect(2).toBe(2); });',
        '});'
      ].join('\n'),
      'test-map.json': mapFor([suite])
    });

    const failures = validateTestIntegrity(root, empty);

    expect(failures).toHaveLength(1);
    // The line and the title are what make it actionable: a file name alone
    // sends the reader through 40 tests looking for the one that lost it.
    expect(failures[0]).toContain('partial.test.ts:3 "does not"');

    integrityFs.rmSync(root, { recursive: true, force: true });
  });

  it('accepts a declaration made once in a beforeEach', () => {
    expect.hasAssertions();

    // Not a loophole. A hook that runs before every test declares for every
    // test as surely as the line inside each body would.
    const suite = 'packages/sample/test/hooked.test.ts';
    const root = scratchRepo('jum702-hook-', {
      [suite]: [
        'describe(\'group\', () => {',
        '  beforeEach(() => { expect.hasAssertions(); });',
        '  it(\'inherits\', () => { expect(1).toBe(1); });',
        '});'
      ].join('\n'),
      'test-map.json': mapFor([suite])
    });

    expect(validateTestIntegrity(root, empty)).toStrictEqual([]);

    integrityFs.rmSync(root, { recursive: true, force: true });
  });

  it('accepts toHaveBeenCalledWith, which asserts the payload (JUM-678)', () => {
    expect.hasAssertions();

    // The measurement error this check shipped with. For a handler whose whole
    // effect is `res.json(payload)`, the argument *is* the effect.
    const suite = 'packages/sample/test/payload.test.ts';
    const root = scratchRepo('jum678-with-', {
      [suite]: [
        'it(\'answers\', () => {',
        '  expect.hasAssertions();',
        '  expect(response.json).toHaveBeenCalledWith({ status: \'result\' });',
        '});'
      ].join('\n'),
      'test-map.json': mapFor([suite])
    });

    expect(validateTestIntegrity(root, empty)).toStrictEqual([]);

    integrityFs.rmSync(root, { recursive: true, force: true });
  });

  it('fails a suite that asserts only that functions were called', () => {
    expect.hasAssertions();

    const suite = 'packages/sample/test/mocked.test.ts';
    const root = scratchRepo('jum678-mockonly-', {
      [suite]: [
        'it(\'writes\', () => {',
        '  expect.hasAssertions();',
        '  expect(repository.save).toHaveBeenCalled();',
        '});'
      ].join('\n'),
      'test-map.json': mapFor([suite])
    });

    const failures = validateTestIntegrity(root, empty);

    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain('asserts only that functions were called');

    integrityFs.rmSync(root, { recursive: true, force: true });
  });

  it('accepts a mock assertion that sits beside an assertion on state', () => {
    expect.hasAssertions();

    // Mocks are not banned; asserting *only* on them is. A call assertion next
    // to a state assertion is how you show both that it ran and what it did.
    const suite = 'packages/sample/test/both.test.ts';
    const root = scratchRepo('jum678-both-', {
      [suite]: [
        'it(\'writes\', () => {',
        '  expect.hasAssertions();',
        '  expect(repository.save).toHaveBeenCalled();',
        '  expect(table.get(\'user-1\')).toStrictEqual({ firstName: \'Ada\' });',
        '});'
      ].join('\n'),
      'test-map.json': mapFor([suite])
    });

    expect(validateTestIntegrity(root, empty)).toStrictEqual([]);

    integrityFs.rmSync(root, { recursive: true, force: true });
  });

  it('reads the sleeps a test uses to synchronise, and ignores a zero flush', () => {
    expect.hasAssertions();

    expect(fixedSleeps(`await new Promise((resolve) => { ${sleepSource(40)} });`))
      .toStrictEqual([40]);
    expect(fixedSleeps(resolveAfter(25))).toStrictEqual([25]);
    // A zero-delay flush is a scheduling assumption, not a wall-clock wait.
    expect(fixedSleeps(sleepSource(0))).toStrictEqual([0]);
  });

  it('fails a suite that sleeps to synchronise', () => {
    expect.hasAssertions();

    const suite = 'packages/sample/test/sleepy.test.ts';
    const root = scratchRepo('jum679-sleep-', {
      [suite]: [
        'it(\'eventually\', async () => {',
        '  expect.hasAssertions();',
        `  await new Promise((resolve) => { ${sleepSource(40)} });`,
        '  expect(store.value).toBe(1);',
        '});'
      ].join('\n'),
      'test-map.json': mapFor([suite])
    });

    const failures = validateTestIntegrity(root, empty);

    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain('sleeps 40ms as synchronisation');

    integrityFs.rmSync(root, { recursive: true, force: true });
  });

  it('fails a suite that no map selects', () => {
    expect.hasAssertions();

    // A suite outside the map is a suite nothing runs, reporting nothing.
    const suite = 'packages/sample/test/unmapped.test.ts';
    const root = scratchRepo('jum680-unmapped-', {
      [suite]: 'it(\'x\', () => { expect.hasAssertions(); expect(1).toBe(1); });\n',
      'test-map.json': mapFor([])
    });

    const failures = validateTestIntegrity(root, empty);

    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain('not in test-map.json');

    integrityFs.rmSync(root, { recursive: true, force: true });
  });

  it('fails a register entry whose file no longer matches', () => {
    expect.hasAssertions();

    // The direction registers usually miss. A stale exemption is how a
    // register stops meaning anything.
    const suite = 'packages/sample/test/fixed.test.ts';
    const root = scratchRepo('jum677-stale-', {
      [suite]: 'it(\'x\', () => { expect.hasAssertions(); expect(1).toBe(1); });\n',
      'test-map.json': mapFor([suite])
    });

    const failures = validateTestIntegrity(root, {
      ...empty,
      acceptedNoAssertions: [{ file: suite, issue: 'JUM-677' }]
    });

    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain('now declares assertions or no longer exists');

    integrityFs.rmSync(root, { recursive: true, force: true });
  });

  it('reads through the modifier chains rather than enumerating them (JUM-702)', () => {
    expect.hasAssertions();

    // `it.each([...])(...)` is a call whose callee is a call; a rule written
    // against the text `it(` misses it, and the one finding in the repository
    // was exactly this shape.
    expect(testsWithoutDeclarations('it.each([1])(\'case %s\', (n) => { expect(n).toBe(1); });'))
      .toStrictEqual([{ title: 'case %s', line: 1 }]);
    expect(testsWithoutDeclarations('it.only(\'x\', () => { expect(1).toBe(1); });'))
      .toStrictEqual([{ title: 'x', line: 1 }]);
  });

  it('says nothing about tests with no body to run', () => {
    expect.hasAssertions();

    // A declaration inside a body that never executes asserts nothing about
    // anything. `it.todo` has no body at all.
    expect(testsWithoutDeclarations('it.todo(\'later\');\nit.skip(\'x\', () => {});'))
      .toStrictEqual([]);
  });

  it('passes against the repository, with every finding on a register', () => {
    expect.hasAssertions();

    expect(validateTestIntegrity(repoRoot)).toStrictEqual([]);
    // The ratchet: these are the findings as measured today. Each entry names
    // the issue that will remove it, and a new violation fails immediately.
    // JUM-677 emptied this one by declaring assertions in all 31 files.
    expect(ACCEPTED_NO_ASSERTIONS).toStrictEqual([]);
    // JUM-678: never fourteen. The rule matched the substring
    // `toHaveBeenCalled`, so `toHaveBeenCalledWith(payload)` read as
    // asserting nothing. It asserts the payload.
    expect(ACCEPTED_MOCK_ONLY).toStrictEqual([]);
    // JUM-679 emptied this one by fixing all five files.
    expect(ACCEPTED_SLEEPS).toStrictEqual([]);
    const owned = [...ACCEPTED_NO_ASSERTIONS, ...ACCEPTED_MOCK_ONLY, ...ACCEPTED_SLEEPS];

    expect(owned.every((entry: { issue: string }) => /^JUM-\d+$/.test(entry.issue))).toBe(true);
  });
});
