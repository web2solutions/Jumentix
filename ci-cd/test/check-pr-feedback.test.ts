const feedbackChecker = require('../check-pr-feedback') as {
  collectConnectionPages: (
    fetchPage: (cursor: string | null) => Promise<unknown>
  ) => Promise<unknown[]>;
  githubGraphql: (
    token: string, query: string, variables: Record<string, unknown>, fetchFn: typeof fetch
  ) => Promise<unknown>;
  isAutomatedStatusDecoration: (comment: unknown) => boolean;
  isCursorUsageLimitNotice: (comment: unknown) => boolean;
  parseResolutionMarker: (body: string) => unknown;
  run: (options: {
    argv?: string[]; env?: Record<string, string>; fetchFn?: typeof fetch
  }) => Promise<void>;
  validatePullRequestFeedback: (feedback: unknown) => void;
};

const COMMENT_URL = 'https://github.com/web2solutions/Jumentix/pull/42#issuecomment-101';
const RESOLUTION_URL = 'https://github.com/web2solutions/Jumentix/pull/42#issuecomment-102';
const SHA = 'abcdef1234567890abcdef1234567890abcdef12';

function makeComment(overrides: Record<string, unknown> = {}) {
  return {
    url: COMMENT_URL,
    body: 'Please handle this finding.',
    author: { login: 'reviewer' },
    authorAssociation: 'NONE',
    ...overrides
  };
}

function makeFeedback(overrides: Record<string, unknown> = {}) {
  return {
    pullRequestAuthor: 'author',
    comments: [],
    reviewThreads: [],
    commits: [SHA],
    ...overrides
  };
}

function resolved(target = COMMENT_URL, sha = SHA) {
  return makeComment({
    url: RESOLUTION_URL,
    author: { login: 'author' },
    body: `<!-- jumentix-pr-feedback: resolved comment=${target} commit=${sha.slice(0, 12)} -->`
  });
}

describe('check-pr-feedback', () => {
  it('fails on an unresolved GitHub review thread', () => {
    expect.hasAssertions();

    expect(() => feedbackChecker.validatePullRequestFeedback(makeFeedback({
      reviewThreads: [{ id: 'thread-1', isResolved: false, comments: [] }]
    }))).toThrow('thread-1 is not resolved');
  });

  it('accepts a natively resolved review thread', () => {
    expect.hasAssertions();

    expect(() => feedbackChecker.validatePullRequestFeedback(makeFeedback({
      reviewThreads: [{ id: 'thread-1', isResolved: true, comments: [] }]
    }))).not.toThrow();
  });

  it('fails general feedback with no visible resolution evidence', () => {
    expect.hasAssertions();

    expect(() => feedbackChecker.validatePullRequestFeedback(makeFeedback({ comments: [makeComment()] }))).toThrow('needs a valid resolved or invalid response marker');
  });

  it('accepts a valid PR-author resolution tied to a PR commit', () => {
    expect.hasAssertions();

    expect(() => feedbackChecker.validatePullRequestFeedback(makeFeedback({
      comments: [makeComment(), resolved()]
    }))).not.toThrow();
  });

  it('rejects malformed resolution markers', () => {
    expect.hasAssertions();

    expect(() => feedbackChecker.validatePullRequestFeedback(makeFeedback({
      comments: [
        makeComment(),
        makeComment({ url: RESOLUTION_URL, author: { login: 'author' }, body: '<!-- jumentix-pr-feedback: resolved -->' })
      ]
    }))).toThrow('well-formed');
  });

  it('rejects a resolution SHA that is not in the pull request', () => {
    expect.hasAssertions();

    expect(() => feedbackChecker.validatePullRequestFeedback(makeFeedback({
      comments: [
        makeComment(), resolved(COMMENT_URL, '1234567890abcdef1234567890abcdef12345678')
      ]
    }))).toThrow('must identify exactly one commit');
  });

  it('rejects a resolution URL that is not a general comment on this pull request', () => {
    expect.hasAssertions();

    expect(() => feedbackChecker.validatePullRequestFeedback(makeFeedback({
      comments: [
        makeComment(), resolved('https://github.com/web2solutions/Jumentix/pull/99#issuecomment-101')
      ]
    }))).toThrow('does not belong to this pull request');
  });

  it('rejects evidence from a commenter who is neither author nor maintainer', () => {
    expect.hasAssertions();

    expect(() => feedbackChecker.validatePullRequestFeedback(makeFeedback({
      comments: [
        makeComment(),
        { ...resolved(), author: { login: 'other' }, authorAssociation: 'NONE' }
      ]
    }))).toThrow('must be authored by the PR author or a repository maintainer');
  });

  it('requires a factual visible explanation for an invalid marker', () => {
    expect.hasAssertions();

    expect(() => feedbackChecker.parseResolutionMarker(`<!-- jumentix-pr-feedback: invalid comment=${COMMENT_URL} -->`)).toThrow('factual visible explanation');
    expect(() => feedbackChecker.validatePullRequestFeedback(makeFeedback({
      comments: [
        makeComment(),
        makeComment({
          url: RESOLUTION_URL,
          author: { login: 'author' },
          body: `This finding is not applicable because the file is generated.\n<!-- jumentix-pr-feedback: invalid comment=${COMMENT_URL} -->`
        })
      ]
    }))).not.toThrow();
  });

  it('exempts only Cursor usage-limit notices', () => {
    expect.hasAssertions();

    const cursorNotice = makeComment({ author: { login: 'cursor' }, body: 'Bugbot couldn\'t run - usage limit reached' });
    expect(feedbackChecker.isCursorUsageLimitNotice(cursorNotice)).toBe(true);
    expect(() => feedbackChecker.validatePullRequestFeedback(makeFeedback({
      comments: [cursorNotice]
    }))).not.toThrow();
    expect(feedbackChecker.isCursorUsageLimitNotice({ ...cursorNotice, author: { login: 'another-bot' } })).toBe(false);
    expect(feedbackChecker.isCursorUsageLimitNotice({ ...cursorNotice, body: 'Please rename this method.' })).toBe(false);
  });

  it('exempts SonarCloud quality-gate decorations, which carry no human feedback', () => {
    expect.hasAssertions();

    const sonarDecoration = makeComment({
      author: { login: 'sonarqubecloud' },
      body: '## [![Quality Gate Passed](https://example/qg-passed.png)] **Quality Gate Passed**'
    });
    expect(feedbackChecker.isAutomatedStatusDecoration(sonarDecoration)).toBe(true);
    expect(() => feedbackChecker.validatePullRequestFeedback(makeFeedback({
      comments: [sonarDecoration]
    }))).not.toThrow();
    expect(feedbackChecker.isAutomatedStatusDecoration({ ...sonarDecoration, author: { login: 'another-bot' } })).toBe(false);
    expect(feedbackChecker.isAutomatedStatusDecoration({ ...sonarDecoration, body: 'Please extract this function.' })).toBe(false);
  });

  it('paginates GitHub connections and fails closed on malformed pages', async () => {
    expect.hasAssertions();

    const fetchPage = jest.fn()
      .mockResolvedValueOnce({ nodes: ['first'], pageInfo: { hasNextPage: true, endCursor: 'cursor-1' } })
      .mockResolvedValueOnce({ nodes: ['second'], pageInfo: { hasNextPage: false, endCursor: null } });
    await expect(feedbackChecker.collectConnectionPages(fetchPage)).resolves.toStrictEqual(['first', 'second']);
    expect(fetchPage).toHaveBeenNthCalledWith(1, null);
    expect(fetchPage).toHaveBeenNthCalledWith(2, 'cursor-1');
    await expect(feedbackChecker.collectConnectionPages(async () => ({ nodes: [], pageInfo: { hasNextPage: true } }))).rejects.toThrow('cursor is missing');
  });

  it('fails closed when GitHub GraphQL rejects the feedback query', async () => {
    expect.hasAssertions();

    const fetchFn = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ errors: [{ message: 'Bad credentials' }] })
    });
    await expect(feedbackChecker.githubGraphql('test-token', 'query { viewer { login } }', {}, fetchFn)).rejects.toThrow('Bad credentials');
  });

  it('fails closed without a GitHub token', async () => {
    expect.hasAssertions();

    await expect(feedbackChecker.run({ argv: ['--repo', 'web2solutions/Jumentix', '--pr', '42'], env: {} })).rejects.toThrow('GH_TOKEN is required');
  });
});
