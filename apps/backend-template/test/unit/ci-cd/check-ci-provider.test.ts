/* eslint-disable @typescript-eslint/no-var-requires */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** Requirement 113 — repository-owned, zero-cost CI for the private repository. */
const repoRoot = path.resolve(__dirname, '../../../../..');
const checker = path.join(repoRoot, 'ci-cd', 'check-ci-provider.js');
const workflowNames = ['test.yml', 'coverage.yml', 'website.yml', 'sonarqube-cloud.yml'];

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
  fs.mkdirSync(path.join(directory, '.github', 'workflows'), { recursive: true });
  fs.copyFileSync(checker, path.join(directory, 'ci-cd', 'check-ci-provider.js'));
  for (const name of workflowNames) {
    fs.copyFileSync(
      path.join(repoRoot, '.github', 'workflows', name),
      path.join(directory, '.github', 'workflows', name)
    );
  }
  change?.(directory);
  return directory;
}

describe('check-ci-provider', () => {
  it('passes against the real repository', () => {
    expect.hasAssertions();

    const result = run(repoRoot);
    expect(result.code).toBe(0);
    expect(result.output).toContain('repository-owned GitHub workflows');
  });

  it('fails when the repository-owned coverage workflow is absent', () => {
    expect.hasAssertions();

    const directory = fixture((root) => fs.unlinkSync(path.join(root, '.github/workflows/coverage.yml')));
    expect(run(directory).output).toContain('Missing required GitHub Actions workflow');
  });

  it('fails when patch coverage enforcement is removed', () => {
    expect.hasAssertions();

    const directory = fixture((root) => {
      const file = path.join(root, '.github/workflows/coverage.yml');
      fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('coverage:patch', 'coverage:removed'));
    });
    expect(run(directory).output).toContain('coverage:patch');
  });

  it('fails when an action is not pinned to an immutable commit', () => {
    expect.hasAssertions();

    const directory = fixture((root) => {
      const file = path.join(root, '.github/workflows/coverage.yml');
      // Replace every use, not the first: the workflow legitimately uploads
      // artifacts in more than one step (per-engine browser evidence, the
      // merged coverage bundle), and a lone `/.../ ` replace() would leave a
      // pinned use standing and never exercise the checker's pin detection.
      fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(/upload-artifact@[0-9a-f]{40}/g, 'upload-artifact@v4'));
    });
    expect(run(directory).output).toContain('upload-artifact');
  });

  it('fails when least-privilege permissions are removed', () => {
    expect.hasAssertions();

    const directory = fixture((root) => {
      const file = path.join(root, '.github/workflows/test.yml');
      fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(/permissions:\n {2}contents: read\n/, ''));
    });
    expect(run(directory).output).toContain('read-only contents permission');
  });

  it.each(['.circleci/config.yml', 'codecov.yml'])('fails when retired contract %s returns', (retired) => {
    expect.hasAssertions();

    const directory = fixture((root) => {
      const file = path.join(root, retired);
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
    expect(text).toContain('107');
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
