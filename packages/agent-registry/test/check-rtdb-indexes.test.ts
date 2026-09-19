/* eslint-disable @typescript-eslint/no-var-requires */

// Imported rather than required so this file is a module: two `fs`/`path`
// declarations at global scope collide across the ci-cd suites (TS2451).
import indexFs from 'fs';
import indexOs from 'os';
import indexPath from 'path';

// The subject of this suite is source text containing `${...}`. Every such
// literal below is the input being checked, not an interpolation that was
// meant to run, so the rule that guards against the typo is inverted here.
/* eslint-disable no-template-curly-in-string */

const {
  queriesIn,
  refSegments,
  rulesIndex,
  validateRtdbIndexes
} = require('../bin/check-rtdb-indexes');

const repoRoot = indexPath.resolve(__dirname, '../../..');

/** The chain that shipped before JUM-656, verbatim. */
const PRE_FIX_QUERY = `
const eventsSnap = await rtdb
  .ref(\`\${BUS_ROOT}/events/\${epicKey}\`)
  .orderByChild('ts')
  .limitToLast(recentLimit)
  .once('value');
`;

function scratchRepo(prefix: string) {
  const root = indexFs.mkdtempSync(indexPath.join(indexOs.tmpdir(), prefix));
  indexFs.mkdirSync(indexPath.join(root, 'packages', 'sample', 'src'), { recursive: true });
  return root;
}

function writeQuery(root: string, source: string) {
  const file = indexPath.join(root, 'packages', 'sample', 'src', 'bus.ts');
  indexFs.writeFileSync(file, source, 'utf8');
}

function writeRules(root: string, rules: unknown) {
  const file = indexPath.join(root, 'database.rules.json');
  indexFs.writeFileSync(file, JSON.stringify(rules, null, 2), 'utf8');
}

describe('rtdb index check (JUM-656)', () => {
  it('reads the ref path and the ordered child out of a chain', () => {
    expect.hasAssertions();

    const result = queriesIn(PRE_FIX_QUERY);

    expect(result.queries).toStrictEqual([
      { refPath: '${BUS_ROOT}/events/${epicKey}', child: 'ts' }
    ]);
    expect(result.unresolved).toBe(0);
  });

  it('treats runtime interpolation as a wildcard segment', () => {
    expect.hasAssertions();

    // The value is decided at runtime, so the check cannot know the key. It can
    // still know the shape, which is what the rules are written against.
    expect(refSegments('${BUS_ROOT}/events/${epicKey}')).toStrictEqual([
      '*', 'events', '*'
    ]);
  });

  it('catches the exact query that shipped before this change', () => {
    expect.hasAssertions();

    // The decisive control. The pre-JUM-656 code passed every test in the
    // repository, because an unindexed query answers correctly — it just
    // downloads the whole node first. If this check would not have failed on
    // it, it would not catch the next one either.
    const root = scratchRepo('jum656-prefix-');
    writeQuery(root, PRE_FIX_QUERY);
    writeRules(root, { rules: { '.read': false, '.write': false } });

    const failures = validateRtdbIndexes(root);

    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain('orders ${BUS_ROOT}/events/${epicKey} by \'ts\'');
    expect(failures[0]).toContain('.indexOn');

    indexFs.rmSync(root, { recursive: true, force: true });
  });

  it('accepts the same query once the rules declare the index', () => {
    expect.hasAssertions();

    const root = scratchRepo('jum656-indexed-');
    writeQuery(root, PRE_FIX_QUERY);
    writeRules(root, {
      rules: {
        '.read': false,
        '.write': false,
        'agent-bus': { events: { $epicId: { '.indexOn': 'ts' } } }
      }
    });

    expect(validateRtdbIndexes(root)).toStrictEqual([]);

    indexFs.rmSync(root, { recursive: true, force: true });
  });

  it('reads the array form of .indexOn', () => {
    expect.hasAssertions();

    expect(rulesIndex({ events: { $id: { '.indexOn': ['kind', 'ts'] } } }, ['events', '*'], 'ts'))
      .toBe(true);
    expect(rulesIndex({ events: { $id: { '.indexOn': ['kind'] } } }, ['events', '*'], 'ts'))
      .toBe(false);
  });

  it('fails closed when the rules are not under version control', () => {
    expect.hasAssertions();

    // An index that cannot be verified is the case this exists for, so a
    // missing rules file must be louder than a missing index, not quieter.
    const root = scratchRepo('jum656-norules-');
    writeQuery(root, PRE_FIX_QUERY);

    const failures = validateRtdbIndexes(root);

    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain('database.rules.json is missing');
    expect(failures[0]).toContain('export-database-rules.js');

    indexFs.rmSync(root, { recursive: true, force: true });
  });

  it('stays quiet when nothing orders by a child', () => {
    expect.hasAssertions();

    // Test doubles name `orderByChild` without querying anything. Reporting
    // those would make the gate noise, and noisy gates get ignored.
    const root = scratchRepo('jum656-doubles-');
    writeQuery(root, 'const fake = { orderByChild: () => fake, limitToLast: () => fake };\n');

    expect(validateRtdbIndexes(root)).toStrictEqual([]);

    indexFs.rmSync(root, { recursive: true, force: true });
  });

  it('passes against the repository as it stands', () => {
    expect.hasAssertions();

    expect(validateRtdbIndexes(repoRoot)).toStrictEqual([]);
  });
});
