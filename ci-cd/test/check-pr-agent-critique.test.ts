const critiqueChecker = require('../check-pr-agent-critique') as {
  MIN_CRITIQUE_PROSE: number;
  validateAgentCritique: (metadata: unknown) => string[];
};
const governance = require('../check-pr-governance') as {
  isAutomatedPullRequest: (metadata: unknown) => boolean;
};

const PROSE = 'The diff holds the gate. No blocking finding remains after the automated exemption.';
const IMPLEMENTER = 'cursor-grok-4.7';
const REVIEWER = 'claude-code-primary-001';

function taskPullRequest(comments: unknown[] = []) {
  return {
    baseRef: 'dev',
    headRef: 'grok/ci/JUM-945-agent-critique-dev-prs',
    title: '[JUM-945][CI] Require an agent critique on non-automated PRs to dev',
    body: `- Epic-delegated agent ID: ${IMPLEMENTER}`,
    comments
  };
}

function critique(
  reviewer: string,
  verdict: 'approve' | 'request-changes',
  createdAt: string,
  prose = PROSE
) {
  return {
    url: `https://github.com/web2solutions/Jumentix/pull/945#issuecomment-${createdAt.replace(/\D/g, '')}`,
    createdAt,
    body: `<!-- jumentix-agent-critique: verdict=${verdict} reviewer=${reviewer} -->\n${prose}`
  };
}

describe('check-pr-agent-critique', () => {
  it('accepts an approve verdict from a different agent', () => {
    expect.hasAssertions();

    expect(critiqueChecker.validateAgentCritique(taskPullRequest([
      critique(REVIEWER, 'approve', '2026-10-23T04:00:00Z')
    ]))).toStrictEqual([]);
  });

  it('blocks while the latest critique requests changes', () => {
    expect.hasAssertions();

    const failures = critiqueChecker.validateAgentCritique(taskPullRequest([
      critique(REVIEWER, 'request-changes', '2026-10-23T04:00:00Z')
    ]));

    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain('requested changes');
    expect(failures[0]).toContain(REVIEWER);
  });

  it('passes once a later approve follows request-changes', () => {
    expect.hasAssertions();

    expect(critiqueChecker.validateAgentCritique(taskPullRequest([
      critique(REVIEWER, 'request-changes', '2026-10-23T04:00:00Z'),
      critique(REVIEWER, 'approve', '2026-10-23T05:00:00Z')
    ]))).toStrictEqual([]);
  });

  it('blocks again when a later critique reopens the review', () => {
    expect.hasAssertions();

    const failures = critiqueChecker.validateAgentCritique(taskPullRequest([
      critique(REVIEWER, 'approve', '2026-10-23T04:00:00Z'),
      critique(REVIEWER, 'request-changes', '2026-10-23T05:00:00Z')
    ]));

    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain('requested changes');
  });

  it('rejects a critique posted by the implementing agent', () => {
    expect.hasAssertions();

    const failures = critiqueChecker.validateAgentCritique(taskPullRequest([
      critique(IMPLEMENTER, 'approve', '2026-10-23T04:00:00Z')
    ]));

    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain(IMPLEMENTER);
    expect(failures[0]).toContain('other than');
  });

  it('ignores a prose mention of the critique token when a later approve exists', () => {
    expect.hasAssertions();

    expect(critiqueChecker.validateAgentCritique(taskPullRequest([
      {
        url: 'https://github.com/web2solutions/Jumentix/pull/945#issuecomment-900',
        createdAt: '2026-10-23T03:00:00Z',
        body: 'The discussion quoted jumentix-agent-critique: without an HTML comment marker.'
      },
      critique(REVIEWER, 'approve', '2026-10-23T04:00:00Z')
    ]))).toStrictEqual([]);
  });

  it('still rejects an HTML comment that is not a well-formed critique marker', () => {
    expect.hasAssertions();

    const failures = critiqueChecker.validateAgentCritique(taskPullRequest([
      {
        url: 'https://github.com/web2solutions/Jumentix/pull/945#issuecomment-901',
        createdAt: '2026-10-23T03:00:00Z',
        body: '<!-- jumentix-agent-critique: verdict=maybe reviewer=someone -->\nThis marker is not a verdict the gate accepts.'
      },
      critique(REVIEWER, 'approve', '2026-10-23T04:00:00Z')
    ]));

    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain('exactly one well-formed');
  });

  it('rejects a critique that is only the marker', () => {
    expect.hasAssertions();

    const failures = critiqueChecker.validateAgentCritique(taskPullRequest([
      critique(REVIEWER, 'approve', '2026-10-23T04:00:00Z', 'too short')
    ]));

    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain(String(critiqueChecker.MIN_CRITIQUE_PROSE));
  });

  it('does not require a critique on an automated dependabot pull request', () => {
    expect.hasAssertions();

    const metadata = {
      baseRef: 'dev',
      headRef: 'dependabot/bun/dev/pinia-4.1.0',
      title: 'chore(deps): bump pinia from 3.0.4 to 4.1.0',
      body: '',
      comments: []
    };

    expect(governance.isAutomatedPullRequest(metadata)).toBe(true);
    expect(critiqueChecker.validateAgentCritique(metadata)).toStrictEqual([]);
  });

  it('does not require a critique on changelog, release, or package-bump automation', () => {
    expect.hasAssertions();

    const changelog = {
      baseRef: 'dev',
      headRef: 'chore/changelog-sync-abcdef12',
      title: 'chore: synchronize changelog',
      body: 'Generated changelog sync, opened automatically by the sync-changelog workflow. Drift fix for JUM-862.',
      comments: []
    };
    const release = {
      baseRef: 'dev',
      headRef: 'chore/release-v0.5.3',
      title: 'chore(release): v0.5.3',
      body: 'Automated application version bump and release for v0.5.3',
      comments: []
    };
    const bump = {
      baseRef: 'dev',
      headRef: 'chore/package-bump-abcdef12',
      title: 'chore(release): bump packages with unpublished content changes',
      body: 'Automated patch bumps for public packages whose published surface changed on `main` while the declared version was already on npm (JUM-917 / Req 070).',
      comments: []
    };

    expect(critiqueChecker.validateAgentCritique(changelog)).toStrictEqual([]);
    expect(critiqueChecker.validateAgentCritique(release)).toStrictEqual([]);
    expect(critiqueChecker.validateAgentCritique(bump)).toStrictEqual([]);
  });

  it('does not apply the gate to pull requests that target main', () => {
    expect.hasAssertions();

    expect(critiqueChecker.validateAgentCritique({
      ...taskPullRequest([]),
      baseRef: 'main',
      comments: []
    })).toStrictEqual([]);
  });

  it('fails closed when the implementing agent is not declared', () => {
    expect.hasAssertions();

    const failures = critiqueChecker.validateAgentCritique({
      ...taskPullRequest([]),
      body: '- Epic-delegated agent ID: none'
    });

    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain('Epic-delegated agent ID');
  });
});
