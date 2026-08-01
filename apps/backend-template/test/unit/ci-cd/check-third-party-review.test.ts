/* eslint-disable @typescript-eslint/no-var-requires */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const repoRoot = path.resolve(__dirname, '../../../../..');
const checker = path.join(repoRoot, 'ci-cd/check-third-party-review.js');
const contracts = [
  '.github/workflows/third-party-review.yml',
  'ci-cd/install-pinned-review-tools.sh',
  '.semgrep.yml'
];

function fixture(change?: (root: string) => void): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'third-party-review-'));
  fs.mkdirSync(path.join(root, 'ci-cd'), { recursive: true });
  fs.copyFileSync(checker, path.join(root, 'ci-cd/check-third-party-review.js'));
  for (const file of contracts) {
    const destination = path.join(root, file);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(path.join(repoRoot, file), destination);
  }
  change?.(root);
  return root;
}

function run(root: string): { code: number; output: string } {
  try {
    return { code: 0, output: execFileSync('bun', ['ci-cd/check-third-party-review.js'], {
      cwd: root, encoding: 'utf8', stdio: 'pipe'
    }) };
  } catch (error) {
    const failure = error as { status?: number; stdout?: string; stderr?: string };
    return { code: failure.status ?? 1, output: `${failure.stdout ?? ''}${failure.stderr ?? ''}` };
  }
}

describe('third-party review contract', () => {
  it('passes for pinned, least-privilege, fail-closed scanners', () => {
    const result = run(repoRoot);
    expect(result.code).toBe(0);
    expect(result.output).toContain('Gitleaks, Semgrep, and Reviewdog');
  });

  it('fails when PR review permission is removed', () => {
    const root = fixture((directory) => {
      const file = path.join(directory, contracts[0]);
      fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('pull-requests: write', 'pull-requests: read'));
    });
    expect(run(root).output).toContain('pull-requests: write');
  });

  it('fails when an action uses a mutable version tag', () => {
    const root = fixture((directory) => {
      const file = path.join(directory, contracts[0]);
      fs.appendFileSync(file, '\n# uses: actions/checkout@v4\n');
    });
    expect(run(root).output).toContain('mutable action reference');
  });

  it('fails when checksum verification is removed', () => {
    const root = fixture((directory) => {
      const file = path.join(directory, contracts[1]);
      fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('sha256sum --check --status', 'true'));
    });
    expect(run(root).output).toContain('sha256sum --check --status');
  });

  it('fails when terminal scanner enforcement is removed', () => {
    const root = fixture((directory) => {
      const file = path.join(directory, contracts[0]);
      fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('Enforce scanner outcomes', 'Ignore scanner outcomes'));
    });
    expect(run(root).output).toContain('Enforce scanner outcomes');
  });
});
