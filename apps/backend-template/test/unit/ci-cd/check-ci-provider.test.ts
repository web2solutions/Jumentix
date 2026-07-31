/* eslint-disable @typescript-eslint/no-var-requires */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Requirement 105 — CircleCI is the sole CI provider.
 *
 * The checker is the thing standing between the migration and a silent
 * regression, so it is tested by making it fail on purpose. A checker that has
 * only ever been observed passing is indistinguishable from one that always
 * passes — which is the false-green shape Requirement 065 exists to prevent, and
 * the reason `ci-cd/check-canonical-integrations` and friends carry the same
 * kind of suite.
 */

const repoRoot = path.resolve(__dirname, '../../../../..');
const checker = path.join(repoRoot, 'ci-cd', 'check-ci-provider.js');

/** Run the checker against a throwaway copy of the repo layout. */
function runAgainst(workingDirectory: string): { code: number; output: string } {
  try {
    const output = execFileSync('bun', [checker], {
      cwd: workingDirectory, encoding: 'utf8', stdio: 'pipe'
    });
    return { code: 0, output };
  } catch (error) {
    const failure = error as { status?: number; stdout?: string; stderr?: string };
    return {
      code: failure.status ?? 1,
      output: `${failure.stdout ?? ''}${failure.stderr ?? ''}`
    };
  }
}

/**
 * A minimal repo the checker can be pointed at.
 *
 * The checker resolves paths relative to its own location, so the fixture is
 * built by copying the two files it reads into a temporary tree beside a copy of
 * the script.
 */
function fixture(build: (dir: string) => void): string {
  const dir = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'ci-provider-'));
  fs.mkdirSync(path.join(dir, 'ci-cd'), { recursive: true });
  fs.copyFileSync(checker, path.join(dir, 'ci-cd', 'check-ci-provider.js'));
  build(dir);
  return dir;
}

const realConfig = fs.readFileSync(
  path.join(repoRoot, '.circleci', 'config.yml'),
  'utf8'
);

const runFixture = (dir: string) => {
  try {
    const output = execFileSync('bun', [path.join(dir, 'ci-cd', 'check-ci-provider.js')], {
      encoding: 'utf8', stdio: 'pipe'
    });
    return { code: 0, output };
  } catch (error) {
    const failure = error as { status?: number; stdout?: string; stderr?: string };
    return {
      code: failure.status ?? 1,
      output: `${failure.stdout ?? ''}${failure.stderr ?? ''}`
    };
  }
};

describe('check-ci-provider', () => {
  it('passes against the real repository', () => {
    expect.hasAssertions();
    const result = runAgainst(repoRoot);

    expect(result.code).toBe(0);
    expect(result.output).toContain('sole provider');
  });

  it('fails when a GitHub Actions workflow is reintroduced', () => {
    expect.hasAssertions();
    // The exact regression the requirement forbids: someone adds a workflow
    // back, and the repository silently has two providers again — one of which
    // cannot execute.
    const dir = fixture((root) => {
      fs.mkdirSync(path.join(root, '.circleci'), { recursive: true });
      fs.writeFileSync(path.join(root, '.circleci', 'config.yml'), realConfig);
      fs.mkdirSync(path.join(root, '.github', 'workflows'), { recursive: true });
      fs.writeFileSync(path.join(root, '.github', 'workflows', 'sneaky.yml'), 'name: sneaky\n');
    });

    const result = runFixture(dir);

    expect(result.code).toBe(1);
    expect(result.output).toContain('sneaky.yml');
  });

  it('fails when the CircleCI configuration is missing entirely', () => {
    expect.hasAssertions();
    const dir = fixture(() => undefined);

    const result = runFixture(dir);

    expect(result.code).toBe(1);
    expect(result.output).toContain('no CI at all');
  });

  it('fails when a retired check was dropped in the migration', () => {
    expect.hasAssertions();
    // The silent regression this checker exists for: a dropped job does not
    // fail anything, the pipeline just covers less and stays green.
    const dir = fixture((root) => {
      fs.mkdirSync(path.join(root, '.circleci'), { recursive: true });
      fs.writeFileSync(
        path.join(root, '.circleci', 'config.yml'),
        realConfig.replace(/website:storybook:build/g, 'removed-by-accident')
      );
    });

    const result = runFixture(dir);

    expect(result.code).toBe(1);
    expect(result.output).toContain('Storybook build');
  });

  it('fails when the quality gate is filtered to the long-lived branches', () => {
    expect.hasAssertions();
    // The state the migration corrected. Filtering to dev and main is how a
    // feature branch ends up merged on local evidence alone.
    const dir = fixture((root) => {
      fs.mkdirSync(path.join(root, '.circleci'), { recursive: true });
      fs.writeFileSync(
        path.join(root, '.circleci', 'config.yml'),
        realConfig.replace(
          '      - quality-gate\n',
          '      - quality-gate:\n          filters:\n            branches:\n              only:\n                - dev\n                - main\n'
        )
      );
    });

    const result = runFixture(dir);

    expect(result.code).toBe(1);
    expect(result.output).toContain('every branch');
  });

  it('still passes when only the sonarqube job is filtered', () => {
    expect.hasAssertions();
    // The control. Sonar is billed per run and only actionable on the
    // long-lived branches, so its filter is legitimate — the checker must not
    // reject it and must not be satisfied by any filter anywhere.
    const result = runAgainst(repoRoot);

    expect(realConfig).toContain('- sonarqube:');
    expect(result.code).toBe(0);
  });
});

describe('requirement 105 is registered', () => {
  it('exists in the requirements directory', () => {
    expect.hasAssertions();
    const requirement = path.join(repoRoot, '.agents', 'requirements', '105-circleci-as-sole-ci-provider.md');

    expect(fs.existsSync(requirement)).toBe(true);
  });

  it('supersedes requirement 012 explicitly', () => {
    expect.hasAssertions();
    // 012 was the previous CircleCI requirement. Leaving both active would
    // make it unclear which governs, and 012's subject — npm/Node engine
    // mismatch — no longer applies now that CircleCI runs the Bun image.
    const text = fs.readFileSync(
      path.join(repoRoot, '.agents', 'requirements', '105-circleci-as-sole-ci-provider.md'),
      'utf8'
    );

    expect(text).toContain('012');
    expect(text).toContain('supersedes');
  });

  it('is enforced by the ci:gate script', () => {
    expect.hasAssertions();
    // A requirement whose checker is never run is documentation, not governance.
    const manifest = JSON.parse(
      fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8')
    ) as { scripts: Record<string, string> };

    expect(manifest.scripts['ci:check-provider']).toContain('check-ci-provider');
    expect(manifest.scripts['ci:gate']).toContain('ci:check-provider');
  });
});
