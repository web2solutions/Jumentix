/* eslint-disable @typescript-eslint/no-var-requires */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const repoRoot = path.resolve(__dirname, '../../../../..');
const checker = path.join(repoRoot, 'ci-cd/check-third-party-review.js');
const contracts = [
  '.github/workflows/ci.yml',
  'ci-cd/install-pinned-review-tools.sh',
  '.semgrep.yml'
];

function fixture(change?: (root: string) => void): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'third-party-review-'));
  fs.mkdirSync(path.join(root, 'ci-cd'), { recursive: true });
  fs.copyFileSync(checker, path.join(root, 'ci-cd/check-third-party-review.js'));
  const yamlRoot = path.dirname(require.resolve('yaml/package.json'));
  fs.cpSync(yamlRoot, path.join(root, 'node_modules/yaml'), { recursive: true });
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
    const output = execFileSync('bun', ['ci-cd/check-third-party-review.js'], {
      cwd: root,
      encoding: 'utf8',
      stdio: 'pipe',
      env: {
        ...process.env,
        NODE_PATH: [path.join(repoRoot, 'node_modules'), process.env.NODE_PATH]
          .filter(Boolean)
          .join(path.delimiter)
      }
    });

    return { code: 0, output };
  } catch (error) {
    const failure = error as { status?: number; stdout?: string; stderr?: string };
    return { code: failure.status ?? 1, output: `${failure.stdout ?? ''}${failure.stderr ?? ''}` };
  }
}

/** Inserts a raw step at the top of the `third-party-review` job's step list. */
function addStepToReviewJob(directory: string, stepYaml: string): void {
  const file = path.join(directory, contracts[0]);
  const text = fs.readFileSync(file, 'utf8');
  const marker = text.indexOf('  third-party-review:');
  const stepsAt = text.indexOf('    steps:\n', marker);
  const insertAt = stepsAt + '    steps:\n'.length;
  fs.writeFileSync(file, text.slice(0, insertAt) + stepYaml + text.slice(insertAt));
}

describe('third-party review contract', () => {
  it('passes for pinned, least-privilege, fail-closed scanners', () => {
    expect.hasAssertions();

    const result = run(repoRoot);
    expect(result.code).toBe(0);
    expect(result.output).toContain('Gitleaks and native Semgrep');
  });

  /**
   * These three used to be two, and the two asserted the opposite (JUM-616).
   *
   * The check matched the raw text of the whole file, so appending a *comment*
   * naming a forbidden construct failed it — and those tests pinned that as the
   * intended behaviour. It is not: a comment explaining why the repository does
   * not do something is indistinguishable, to a text match, from doing it, and
   * the cheapest response is to delete the explanation.
   *
   * The check reads the parsed `third-party-review` job now, so a violation has
   * to be a violation.
   */
  it('fails when the review job declares the remote-docker step', () => {
    expect.hasAssertions();

    const root = fixture((directory) => {
      addStepToReviewJob(directory, '      - setup_remote_docker\n');
    });
    expect(run(root).output).toContain('without remote Docker workspace mounts');
  });

  it('fails when the review job shells out to docker run', () => {
    expect.hasAssertions();

    const root = fixture((directory) => {
      addStepToReviewJob(
        directory,
        '      - run:\n          name: probe\n          command: docker run -v "$PWD:/src" scanner\n'
      );
    });
    expect(run(root).output).toContain('without remote Docker workspace mounts');
  });

  it('fails when a command in the review job uses a mutable version tag', () => {
    expect.hasAssertions();

    const root = fixture((directory) => {
      addStepToReviewJob(
        directory,
        '      - run:\n          name: probe\n          command: "uses: actions/checkout@v4"\n'
      );
    });
    expect(run(root).output).toContain('mutable action reference');
  });

  /**
   * The regression this issue is named for. A comment that names a forbidden
   * construct — to explain why it is not used — must not fail the check.
   */
  it('tolerates a comment that names a forbidden construct', () => {
    expect.hasAssertions();

    const root = fixture((directory) => {
      const file = path.join(directory, contracts[0]);
      fs.appendFileSync(
        file,
        '\n# A machine executor rather than setup_remote_docker, and never docker run.\n'
        + '# uses: actions/checkout@v4 would be a mutable reference.\n'
      );
    });

    const result = run(root);

    expect(result.code).toBe(0);
    expect(result.output).toContain('Gitleaks and native Semgrep');
  });

  /**
   * The other bound. The rule is about the third-party job, so it must not
   * constrain a job it was never about — `database-matrix` legitimately needs
   * its own docker handling.
   */
  it('ignores docker usage in a job that is not the review job', () => {
    expect.hasAssertions();

    const root = fixture((directory) => {
      const file = path.join(directory, contracts[0]);
      const text = fs.readFileSync(file, 'utf8').replace(
        '  workspace-builds:',
        '  unrelated-job:\n'
        + '    runs-on: ubuntu-latest\n'
        + '    steps:\n'
        + '      - setup_remote_docker\n'
        + '      - run:\n'
        + '          name: probe\n'
        + '          command: docker run hello-world\n'
        + '\n'
        + '  workspace-builds:'
      );
      fs.writeFileSync(file, text);
    });

    expect(run(root).code).toBe(0);
  });

  it('fails closed when the review job is missing entirely', () => {
    expect.hasAssertions();

    const root = fixture((directory) => {
      const file = path.join(directory, contracts[0]);
      // Renamed, not deleted: a job that is not there is not an absent
      // violation, it is a contract that is not being run at all.
      fs.writeFileSync(
        file,
        fs.readFileSync(file, 'utf8').replace('  third-party-review:', '  renamed-review:')
      );
    });

    expect(run(root).output).toContain('declares no "third-party-review" job');
  });

  it('fails when checksum verification is removed', () => {
    expect.hasAssertions();

    const root = fixture((directory) => {
      const file = path.join(directory, contracts[1]);
      fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('checksum mismatch', 'checksum skipped'));
    });
    expect(run(root).output).toContain('checksum mismatch');
  });

  it('fails when terminal scanner enforcement is removed', () => {
    expect.hasAssertions();

    const root = fixture((directory) => {
      const file = path.join(directory, contracts[0]);
      fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('Enforce scanner outcomes', 'Ignore scanner outcomes'));
    });
    expect(run(root).output).toContain('Enforce scanner outcomes');
  });

  it('fails when the review job uses an unapproved JavaScript Action', () => {
    expect.hasAssertions();

    const root = fixture((directory) => {
      addStepToReviewJob(directory, '      - uses: actions/upload-artifact@v7\n');
    });

    expect(run(root).output).toContain('may only use bootstrap actions');
  });

  it('fails when scanner evidence listing is removed', () => {
    expect.hasAssertions();

    const root = fixture((directory) => {
      const file = path.join(directory, contracts[0]);
      fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('List review evidence', 'Hide review evidence'));
    });

    expect(run(root).output).toContain('List review evidence');
  });

  it('fails when scanner enforcement depends on artifact upload success', () => {
    expect.hasAssertions();

    const root = fixture((directory) => {
      const file = path.join(directory, contracts[0]);
      const alwaysEnforce = [
        '      - name: Enforce scanner outcomes',
        '        if: always()',
        ''
      ].join('\n');
      fs.writeFileSync(
        file,
        fs.readFileSync(file, 'utf8').replace(
          alwaysEnforce,
          '      - name: Enforce scanner outcomes\n'
        )
      );
    });

    expect(run(root).output).toContain('scanner enforcement must run even when evidence upload fails');
  });
});
