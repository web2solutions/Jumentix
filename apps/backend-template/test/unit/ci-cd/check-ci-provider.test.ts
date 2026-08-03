/* eslint-disable @typescript-eslint/no-var-requires */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** Requirement 113 — repository-owned, zero-cost CI for the private repository. */
const repoRoot = path.resolve(__dirname, '../../../../..');
const checker = path.join(repoRoot, 'ci-cd', 'check-ci-provider.js');

function run(directory: string): { code: number; output: string } {
  try {
    return {
      code: 0,
      output: execFileSync('bun', [path.join(directory, 'ci-cd', 'check-ci-provider.js')], {
        cwd: directory, encoding: 'utf8', stdio: 'pipe'
      })
    };
  } catch (error) {
    const failure = error as { status?: number; stdout?: string; stderr?: string };
    return { code: failure.status ?? 1, output: `${failure.stdout ?? ''}${failure.stderr ?? ''}` };
  }
}

function fixture(change?: (directory: string) => void): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-provider-'));
  fs.mkdirSync(path.join(directory, 'ci-cd'), { recursive: true });
  fs.mkdirSync(path.join(directory, '.circleci'), { recursive: true });
  fs.copyFileSync(checker, path.join(directory, 'ci-cd', 'check-ci-provider.js'));
  fs.copyFileSync(path.join(repoRoot, '.circleci/config.yml'), path.join(directory, '.circleci/config.yml'));
  change?.(directory);
  return directory;
}

describe('check-ci-provider', () => {
  it('passes against the real repository', () => {
    expect.hasAssertions();

    const result = run(repoRoot);
    expect(result.code).toBe(0);
    expect(result.output).toContain('CircleCI covers');
  });

  it('fails when the repository-owned CircleCI config is absent', () => {
    expect.hasAssertions();

    const directory = fixture((root) => fs.unlinkSync(path.join(root, '.circleci/config.yml')));
    expect(run(directory).output).toContain('Missing required CircleCI config');
  });

  it('fails when patch coverage enforcement is removed', () => {
    expect.hasAssertions();

    const directory = fixture((root) => {
      const file = path.join(root, '.circleci/config.yml');
      fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('coverage:patch', 'coverage:removed'));
    });
    expect(run(directory).output).toContain('coverage:patch');
  });

  it('fails when an essential CircleCI job is absent', () => {
    expect.hasAssertions();

    const directory = fixture((root) => {
      const file = path.join(root, '.circleci/config.yml');
      fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('third-party-review:', 'third-party-review-removed:'));
    });
    expect(run(directory).output).toContain('third-party-review');
  });

  it('fails when a GitHub Actions workflow returns while billing is blocked', () => {
    expect.hasAssertions();

    const directory = fixture((root) => {
      const file = path.join(root, '.github/workflows/test.yml');
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, 'name: should-not-run\n');
    });
    expect(run(directory).output).toContain('GitHub Actions workflow is disabled');
  });

  it('fails when retired Codecov contract returns', () => {
    expect.hasAssertions();

    const directory = fixture((root) => {
      const file = path.join(root, 'codecov.yml');
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, 'retired: true\n');
    });
    expect(run(directory).output).toContain('retired by Requirement 113');
  });
});

describe('requirement 113 is registered and enforced', () => {
  it('exists and supersedes the provider-specific requirements', () => {
    expect.hasAssertions();

    const requirement = path.join(
      repoRoot,
      '.agents/requirements/project/113-private-free-repository-owned-ci.md'
    );
    const text = fs.readFileSync(requirement, 'utf8');
    expect(text).toContain('014');
    expect(text).toContain('CircleCI');
    expect(text).toContain('GitHub Actions billing');
  });

  it('is enforced by the canonical gate', () => {
    expect.hasAssertions();

    const manifest = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    expect(manifest.scripts['ci:check-provider']).toContain('check-ci-provider');
    expect(manifest.scripts['ci:gate']).toContain('ci:check-provider');
  });
});
