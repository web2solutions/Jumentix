import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const {
  findViolations,
  layerFor,
  stripCodeComments,
  validateDocumentationAudience
} = require('../check-documentation-audience.js');

/**
 * Requirement 066 audience matrix (JUM-892).
 *
 * The negative control is the leak that shipped: the root README restating
 * `JUMENTIX_ENABLE_GITHUB_ACTIONS_CI` and the CI-provider fallback rule to a
 * first-time visitor. Every existing documentation check passed it.
 */

const LEAK_LINE = 'CircleCI is the canonical CI orchestrator; GitHub Actions is retained and can be '
  + 're-enabled by setting `JUMENTIX_ENABLE_GITHUB_ACTIONS_CI` to `true`.';

type Fixture = { root: string; allowlistPath: string };

function workspace(files: Record<string, string>, allowlist: unknown = []): Fixture {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'doc-audience-'));
  for (const [relative, contents] of Object.entries(files)) {
    const target = path.join(root, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, contents, 'utf8');
  }
  const allowlistPath = path.join(root, 'allowlist.json');
  fs.writeFileSync(allowlistPath, JSON.stringify(allowlist), 'utf8');
  return { root, allowlistPath };
}

function run(files: Record<string, string>, allowlist: unknown = []): string[] {
  const { root, allowlistPath } = workspace(files, allowlist);
  return validateDocumentationAudience({ rootDir: root, allowlistPath, files: Object.keys(files) });
}

describe('documentation audience gate', () => {
  it('fails on the README leak that shipped, naming file, line and rule', () => {
    expect.hasAssertions();

    const failures = run({ 'README.md': `# Jumentix\n\n${LEAK_LINE}\n` });

    expect(failures).toStrictEqual(expect.arrayContaining([
      'README.md:3: [prospect] internal CI/gate control variable (internal-ci-variable)',
      'README.md:3: [prospect] internal CI-provider canonical/fallback mechanics (ci-provider-mechanics)'
    ]));
  });

  it('passes the same README once the leak is removed', () => {
    expect.hasAssertions();

    expect(run({ 'README.md': '# Jumentix\n\nShip services from one contract.\n' })).toStrictEqual([]);
  });

  it('catches the Portuguese phrasing of the same leak', () => {
    expect.hasAssertions();

    const failures = run({ 'README.pt-BR.md': 'CircleCI e o orquestrador canonico de CI; o GitHub Actions esta retido.\n' });

    expect(failures).toStrictEqual(['README.pt-BR.md:1: [prospect] internal CI-provider canonical/fallback mechanics (ci-provider-mechanics)']);
  });

  it('allows public runtime configuration keys', () => {
    expect.hasAssertions();

    const page = 'Set `JUMENTIX_HTTP_FRAMEWORK=fastify` and `JUMENTIX_DATABASE_DRIVER=SQLite`.\n';

    expect(run({ 'apps/jumentix-website/content/jumentix/guides/rest-api.mdx': page })).toStrictEqual([]);
  });

  it('flags requirement numbers, issue ids and .agents paths on the developer site', () => {
    expect.hasAssertions();

    const page = [
      'Amended by Requirement 126.',
      'Landed by JUM-460.',
      'See [the rule](../../.agents/requirements/project/066.md).'
    ].join('\n');
    const failures = run({ 'apps/jumentix-website/content/pt-BR/jumentix/reference/x.mdx': page });

    expect(failures.map((failure) => failure.replace(/^.*\((.+)\)$/, '$1'))).toStrictEqual([
      'requirement-number',
      'linear-issue-id',
      'agents-path'
    ]);
  });

  it('ignores contributor comments in code but flags rendered strings', () => {
    expect.hasAssertions();

    const component = [
      '// JUM-640: route parity for the locale switch.',
      '/* Requirement 092 keeps both locales. */',
      'export const note = "Tracked in JUM-12";',
      'export const url = "https://example.com//path";'
    ].join('\n');
    const failures = run({ 'apps/jumentix-website/components/commercial/Note.tsx': component });

    expect(failures).toStrictEqual(['apps/jumentix-website/components/commercial/Note.tsx:3: [prospect] Linear issue id in a public layer (linear-issue-id)']);
  });

  it('keeps URL schemes when stripping comments', () => {
    expect.hasAssertions();

    expect(stripCodeComments('const a = "https://x.dev"; // JUM-1')).toBe('const a = "https://x.dev"; ');
  });

  it('leaves tests, stories and non-public files out of the matrix', () => {
    expect.hasAssertions();

    const outside = [
      'apps/jumentix-website/components/a/A.test.tsx',
      'apps/jumentix-website/components/a/A.stories.tsx',
      'documentation/md/CI-PROVIDER-GOVERNANCE.md',
      '.agents/requirements/project/113-private-free-repository-owned-ci.md'
    ];

    expect(outside.map((file) => layerFor(file))).toStrictEqual([null, null, null, null]);
    expect(findViolations('documentation/md/X.md', LEAK_LINE)).toStrictEqual([]);
  });

  it('places the README and the docs tree in their public layers', () => {
    expect.hasAssertions();

    expect(layerFor('README.md')).toBe('prospect');
    expect(layerFor('apps/jumentix-website/content/jumentix/guides/a.mdx')).toBe('developer-site');
  });

  it('honours an allow-list entry that still matches', () => {
    expect.hasAssertions();

    const allowlist = [{
      file: 'README.md', rule: 'linear-issue-id', issue: 'JUM-893', reason: 'fixture'
    }];

    expect(run({ 'README.md': 'Tracked in JUM-1.\n' }, allowlist)).toStrictEqual([]);
  });

  it('fails a stale allow-list entry whose file is already clean', () => {
    expect.hasAssertions();

    const allowlist = [{
      file: 'README.md', rule: 'linear-issue-id', issue: 'JUM-893', reason: 'fixture'
    }];

    expect(run({ 'README.md': 'Clean.\n' }, allowlist)).toStrictEqual([
      'README.md: allow-list entry for linear-issue-id (JUM-893) no longer matches — remove it'
    ]);
  });

  it('fails an allow-list entry naming a deleted file', () => {
    expect.hasAssertions();

    const allowlist = [{
      file: 'README.gone.md', rule: 'agents-path', issue: 'JUM-893', reason: 'fixture'
    }];

    expect(run({ 'README.md': 'Clean.\n' }, allowlist)).toStrictEqual([
      'README.gone.md: allow-list entry for agents-path names a file that no longer exists — remove it'
    ]);
  });

  it('fails closed on a malformed allow-list', () => {
    expect.hasAssertions();

    const missingIssue = [{ file: 'README.md', rule: 'agents-path' }];

    expect(() => run({ 'README.md': 'Clean.\n' }, missingIssue)).toThrow('missing "issue"');
    expect(() => run({ 'README.md': 'Clean.\n' }, [{
      file: 'README.md', rule: 'nope', issue: 'JUM-1', reason: 'r'
    }])).toThrow('unknown rule');
    expect(() => run({ 'README.md': 'Clean.\n' }, { not: 'an array' })).toThrow('must be a JSON array');
  });
});
