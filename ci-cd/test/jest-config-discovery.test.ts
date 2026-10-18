import path from 'path';

const repoRoot = path.resolve(__dirname, '..', '..');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const config = require(path.join(repoRoot, 'jest.config.js'));

function resolvePatterns(patterns: string[]): RegExp[] {
  return patterns.map((pattern) => new RegExp(pattern.replace('<rootDir>', repoRoot)));
}

function ignored(patterns: string[], file: string): boolean {
  return resolvePatterns(patterns).some((pattern) => pattern.test(file));
}

describe('jest.config.js discovery scope', () => {
  // Agent tooling keeps git worktrees of this repository under `.claude/`.
  // Jest reads path arguments as regexes, so before JUM-933 a selected suite
  // also matched its copy inside a sibling worktree, which ran against an
  // unbuilt tree and failed the task gate.
  const worktreeCopy = path.join(repoRoot, '.claude', 'worktrees', 'sibling', 'packages', 'cli-init', 'test', 'bootstrap.test.ts');
  const realSuite = path.join(repoRoot, 'packages', 'cli-init', 'test', 'bootstrap.test.ts');

  it('never discovers suites inside an agent worktree under .claude/', () => {
    expect.hasAssertions();
    expect(ignored(config.testPathIgnorePatterns, worktreeCopy)).toBe(true);
    expect(ignored(config.modulePathIgnorePatterns, worktreeCopy)).toBe(true);
  });

  it('still discovers the repository suite the worktree copy shadows', () => {
    expect.hasAssertions();
    expect(ignored(config.testPathIgnorePatterns, realSuite)).toBe(false);
    expect(ignored(config.modulePathIgnorePatterns, realSuite)).toBe(false);
  });
});
