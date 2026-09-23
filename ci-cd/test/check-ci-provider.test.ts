/* eslint-disable @typescript-eslint/no-var-requires */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** Requirement 113 — free CI for the public open-source repository. */
const repoRoot = path.resolve(__dirname, '../..');
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
  fs.mkdirSync(path.join(directory, '.github/workflows'), { recursive: true });
  fs.mkdirSync(path.join(directory, '.circleci'), { recursive: true });
  fs.mkdirSync(path.join(directory, '.husky'), { recursive: true });
  fs.copyFileSync(checker, path.join(directory, 'ci-cd', 'check-ci-provider.js'));
  fs.copyFileSync(path.join(repoRoot, 'ci-cd', 'run-unit-tests.js'), path.join(directory, 'ci-cd', 'run-unit-tests.js'));
  fs.copyFileSync(path.join(repoRoot, 'ci-cd', 'ensure-local-ci-services.sh'), path.join(directory, 'ci-cd', 'ensure-local-ci-services.sh'));
  fs.copyFileSync(path.join(repoRoot, 'ci-cd', 'ensure-docker-runtime.sh'), path.join(directory, 'ci-cd', 'ensure-docker-runtime.sh'));
  fs.copyFileSync(path.join(repoRoot, '.github/workflows/ci.yml'), path.join(directory, '.github/workflows/ci.yml'));
  fs.copyFileSync(path.join(repoRoot, '.github/workflows/pr-feedback.yml'), path.join(directory, '.github/workflows/pr-feedback.yml'));
  fs.copyFileSync(path.join(repoRoot, '.github/workflows/sonar-reliability.yml'), path.join(directory, '.github/workflows/sonar-reliability.yml'));
  fs.copyFileSync(path.join(repoRoot, '.github/workflows/browser-matrix.yml'), path.join(directory, '.github/workflows/browser-matrix.yml'));
  fs.copyFileSync(path.join(repoRoot, '.circleci/config.yml'), path.join(directory, '.circleci/config.yml'));
  fs.copyFileSync(path.join(repoRoot, '.husky/pre-commit'), path.join(directory, '.husky/pre-commit'));
  fs.copyFileSync(path.join(repoRoot, 'sonar-project.properties'), path.join(directory, 'sonar-project.properties'));
  fs.copyFileSync(path.join(repoRoot, 'package.json'), path.join(directory, 'package.json'));
  change?.(directory);
  return directory;
}

describe('check-ci-provider', () => {
  it('passes against the real repository', () => {
    expect.hasAssertions();

    const result = run(repoRoot);
    expect(result.code).toBe(0);
    expect(result.output).toContain('GitHub Actions and CircleCI cover');
  });

  it('fails when the repository-owned GitHub Actions workflow is absent', () => {
    expect.hasAssertions();

    const directory = fixture((root) => fs.unlinkSync(path.join(root, '.github/workflows/ci.yml')));
    expect(run(directory).output).toContain('Missing required GitHub Actions workflow');
  });

  it('fails when the trusted PR feedback workflow is absent or checks out PR code', () => {
    expect.hasAssertions();

    const missing = fixture((root) => fs.unlinkSync(path.join(root, '.github/workflows/pr-feedback.yml')));
    expect(run(missing).output).toContain('Missing required trusted pull-request workflow');

    const untrusted = fixture((root) => {
      const file = path.join(root, '.github/workflows/pr-feedback.yml');
      fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('github.event.pull_request.base.sha', 'github.event.pull_request.head.sha'));
    });
    expect(run(untrusted).output).toContain('must execute only the trusted PR base revision');
  });

  it('fails when the CI PR feedback job loses its trusted bootstrap', () => {
    expect.hasAssertions();

    const directory = fixture((root) => {
      const file = path.join(root, '.github/workflows/ci.yml');
      fs.writeFileSync(
        file,
        fs.readFileSync(file, 'utf8').replace('Bootstrap trusted PR feedback checker', 'Bootstrap removed')
      );
    });
    expect(run(directory).output).toContain('Bootstrap trusted PR feedback checker');
  });

  it('fails when Sonar reliability is no longer a trusted required PR gate', () => {
    expect.hasAssertions();

    const directory = fixture((root) => {
      const file = path.join(root, '.github/workflows/sonar-reliability.yml');
      fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(/SONAR_PULL_REQUEST:/g, 'SONAR_PULL_REQUEST_REMOVED:'));
    });
    expect(run(directory).output).toContain('SONAR_PULL_REQUEST');
  });

  it('fails when the Sonar workflow stops analyzing the pull request', () => {
    expect.hasAssertions();

    const directory = fixture((root) => {
      const file = path.join(root, '.github/workflows/sonar-reliability.yml');
      fs.writeFileSync(
        file,
        fs.readFileSync(file, 'utf8').replace('-Dsonar.pullrequest.key="$SONAR_PULL_REQUEST"', '-Dsonar.pullrequest.key="removed"')
      );
    });
    expect(run(directory).output).toContain('sonar\\.pullrequest\\.key');
  });

  it('fails when Sonar analysis returns to a privileged pull_request_target workflow', () => {
    expect.hasAssertions();

    const directory = fixture((root) => {
      const file = path.join(root, '.github/workflows/sonar-reliability.yml');
      fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('pull_request:', 'pull_request_target:'));
    });
    expect(run(directory).output).toContain('unprivileged pull_request workflow');
  });

  it('fails when the required browser matrix is absent or can receive secrets', () => {
    expect.hasAssertions();

    const missing = fixture((root) => fs.unlinkSync(path.join(root, '.github/workflows/browser-matrix.yml')));
    expect(run(missing).output).toContain('Missing required browser matrix workflow');

    const privileged = fixture((root) => {
      const file = path.join(root, '.github/workflows/browser-matrix.yml');
      fs.appendFileSync(file, `\nenv:\n  TOKEN: ${'${'}{ secrets.TOKEN }}\n`);
    });
    expect(run(privileged).output).toContain('must run untrusted PR code without privileged events or secrets');

    const missingPathBootstrap = fixture((root) => {
      const file = path.join(root, '.github/workflows/browser-matrix.yml');
      fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('export PATH="$HOME/.bun/bin:$PATH"', ''));
    });
    expect(run(missingPathBootstrap).output).toContain('export PATH');
  });

  it('fails when CircleCI is absent', () => {
    expect.hasAssertions();

    const directory = fixture((root) => {
      fs.unlinkSync(path.join(root, '.circleci/config.yml'));
    });
    expect(run(directory).output).toContain('Missing required CircleCI workflow');
  });

  it('fails when patch coverage enforcement is removed', () => {
    expect.hasAssertions();

    const directory = fixture((root) => {
      const file = path.join(root, '.github/workflows/ci.yml');
      fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('coverage:patch', 'coverage:removed'));
    });
    expect(run(directory).output).toContain('coverage:patch');
  });

  it('fails when generated changelog PRs skip required main-release jobs', () => {
    expect.hasAssertions();

    const directory = fixture((root) => {
      const file = path.join(root, '.github/workflows/ci.yml');
      fs.writeFileSync(
        file,
        fs.readFileSync(file, 'utf8').replace(/startsWith\(github\.head_ref, 'chore\/changelog-sync-'\) \|\|\n/g, '')
      );
    });
    expect(run(directory).output).toContain('chore\\/changelog-sync-');
  });

  it('fails when dev-to-main patch coverage no longer uses the protected dev baseline', () => {
    expect.hasAssertions();

    const directory = fixture((root) => {
      const file = path.join(root, '.github/workflows/ci.yml');
      fs.writeFileSync(
        file,
        fs.readFileSync(file, 'utf8').replace(
          'JUMENTIX_PATCH_BASE_REF=origin/dev bun run coverage:patch',
          'bun run coverage:patch'
        )
      );
    });
    const { output } = run(directory);
    expect(output).toContain('JUMENTIX_PATCH_BASE_REF=origin');
    expect(output).toContain('coverage:patch');
  });

  it('fails when changelog and signed reconciliation patch coverage no longer use the main baseline', () => {
    expect.hasAssertions();

    const directory = fixture((root) => {
      const file = path.join(root, '.github/workflows/ci.yml');
      fs.writeFileSync(
        file,
        fs.readFileSync(file, 'utf8').replace(
          'JUMENTIX_PATCH_BASE_REF=origin/main bun run coverage:patch',
          'bun run coverage:patch'
        )
      );
    });

    const { output } = run(directory);
    expect(output).toContain('JUMENTIX_PATCH_BASE_REF=origin\\/main bun run coverage:patch');
  });

  it('fails when an essential GitHub Actions job is absent', () => {
    expect.hasAssertions();

    const directory = fixture((root) => {
      const file = path.join(root, '.github/workflows/ci.yml');
      fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('third-party-review:', 'third-party-review-removed:'));
    });
    expect(run(directory).output).toContain('third-party-review');
  });

  it('fails when the database matrix stops building workspace dependencies', () => {
    expect.hasAssertions();

    const directory = fixture((root) => {
      const file = path.join(root, '.github/workflows/ci.yml');
      fs.writeFileSync(
        file,
        fs.readFileSync(file, 'utf8').replace(
          '      - name: Build workspace package dependencies\n        run: bun run mono:build\n',
          ''
        )
      );
    });
    expect(run(directory).output).toContain('Database matrix must build workspace package dependencies');
  });

  it('fails when generated changelog synchronization is no longer main-only', () => {
    expect.hasAssertions();

    const directory = fixture((root) => {
      const file = path.join(root, '.github/workflows/ci.yml');
      fs.writeFileSync(
        file,
        fs.readFileSync(file, 'utf8').replace(
          'github.event_name == \'push\' && github.ref_name == \'main\'',
          'github.event_name == \'push\' && github.ref_name == \'dev\''
        )
      );
    });
    expect(run(directory).output).toContain('github\\.event_name == \'push\' && github\\.ref_name == \'main\'');
  });

  it('fails when Bun installation can mask a failed download', () => {
    expect.hasAssertions();

    const directory = fixture((root) => {
      const file = path.join(root, '.github/workflows/ci.yml');
      fs.writeFileSync(
        file,
        fs.readFileSync(file, 'utf8').replace(
          'curl -fsSL -o /tmp/bun-install.sh https://bun.sh/install',
          'curl -fsSL https://bun.sh/install | bash'
        )
      );
    });
    expect(run(directory).output).toContain('Bun installation must fail closed');
  });

  it('fails when a local hook resumes mutating the generated changelog', () => {
    expect.hasAssertions();

    const directory = fixture((root) => {
      const file = path.join(root, '.husky/pre-commit');
      fs.appendFileSync(file, '\nbun run changelog:update && git add CHANGELOG.md\n');
    });
    expect(run(directory).output).toContain('must not mutate CHANGELOG.md');
  });

  it('fails when self-hosted private runners return to the canonical workflow', () => {
    expect.hasAssertions();

    const directory = fixture((root) => {
      const file = path.join(root, '.github/workflows/ci.yml');
      fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('runs-on: ubuntu-latest', 'runs-on: [self-hosted, jumentix]'));
    });
    expect(run(directory).output).toContain('GitHub-hosted ubuntu-latest runners');
  });

  it('fails when Docker runtime bootstrap is removed from container-backed jobs', () => {
    expect.hasAssertions();

    const directory = fixture((root) => {
      fs.unlinkSync(path.join(root, 'ci-cd', 'ensure-docker-runtime.sh'));
    });
    expect(run(directory).output).toContain('open -ga Docker');
  });

  it('fails when the website Storybook build no longer builds exported workspace dependencies', () => {
    expect.hasAssertions();

    const directory = fixture((root) => {
      const file = path.join(root, 'package.json');
      fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(/website:deps:build/g, 'website:deps:removed'));
    });
    expect(run(directory).output).toContain('website:deps:build');
  });

  it('fails when the website dependency build omits shared contracts before the SDKs', () => {
    expect.hasAssertions();

    const directory = fixture((root) => {
      const file = path.join(root, 'package.json');
      fs.writeFileSync(
        file,
        fs.readFileSync(file, 'utf8').replace('bun run --filter @jumentix/shared-contracts build && ', '')
      );
    });
    expect(run(directory).output).toContain('@jumentix\\/shared-contracts build');
  });

  it('fails when monorepo builds no longer use the topological workspace builder', () => {
    expect.hasAssertions();

    const directory = fixture((root) => {
      const file = path.join(root, 'package.json');
      fs.writeFileSync(
        file,
        fs.readFileSync(file, 'utf8').replace(
          '"mono:build": "bun run workspace:build:packages"',
          '"mono:build": "bun run mono:build:parallel"'
        )
      );
    });
    expect(run(directory).output).toContain('Monorepo build must delegate');
  });

  it('fails when unit tests stop building publishable workspace artifacts first', () => {
    expect.hasAssertions();

    const directory = fixture((root) => {
      const file = path.join(root, 'package.json');
      fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(/workspace:build:packages/g, 'workspace:build:removed'));
    });
    expect(run(directory).output).toContain('workspace:build:packages');
  });

  it('fails when monorepo tests stop building workspace dependencies first', () => {
    expect.hasAssertions();

    const directory = fixture((root) => {
      const file = path.join(root, 'package.json');
      fs.writeFileSync(
        file,
        fs.readFileSync(file, 'utf8').replace(
          '"mono:test": "bun run workspace:build:packages && bun run workspace:test"',
          '"mono:test": "bun run workspace:test"'
        )
      );
    });
    expect(run(directory).output).toContain('Monorepo tests must build workspace package dependencies');
  });

  it('fails when unit tests stop resolving workspace packages from source', () => {
    expect.hasAssertions();

    const directory = fixture((root) => {
      const file = path.join(root, 'ci-cd', 'run-unit-tests.js');
      fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(/--conditions=development/g, '--conditions=production'));
    });
    expect(run(directory).output).toContain('--conditions=development');
  });

  it('fails when expensive jobs lose the release/full context guard', () => {
    expect.hasAssertions();

    const directory = fixture((root) => {
      const file = path.join(root, '.github/workflows/ci.yml');
      fs.writeFileSync(
        file,
        fs.readFileSync(file, 'utf8').replace(
          /\|\|\n\s+\(startsWith\(github\.head_ref, 'codex\/release\/'\) && endsWith\(github\.head_ref, '-dev-main-signed-squash'\)\)/g,
          ''
        )
      );
    });
    expect(run(directory).output).toContain('must guard coverage to main/dev/release contexts');
  });

  it('fails when the coverage job re-enables real broker or Redis integration suites', () => {
    expect.hasAssertions();

    const directory = fixture((root) => {
      const file = path.join(root, '.github/workflows/ci.yml');
      fs.writeFileSync(
        file,
        fs.readFileSync(file, 'utf8').replace(
          '      AAA_JWT_TOKEN_SECRET_KEY: ci_jwt_secret_key\n'
            + '      AAA_REDIS_HOST: 127.0.0.1',
          '      AAA_JWT_TOKEN_SECRET_KEY: ci_jwt_secret_key\n'
            + '      RUN_BROKER_INTEGRATION: \'1\'\n'
            + '      RUN_REDIS_INTEGRATION: \'1\'\n'
            + '      AAA_REDIS_HOST: 127.0.0.1'
        )
      );
    });
    expect(run(directory).output).toContain('coverage job must keep real broker/Redis integration suites');
  });

  it('fails when frontend patch coverage runs before its workspace dependencies are built', () => {
    expect.hasAssertions();

    const directory = fixture((root) => {
      const file = path.join(root, '.github/workflows/ci.yml');
      fs.writeFileSync(
        file,
        fs.readFileSync(file, 'utf8').replace(
          '      - name: Build workspace package dependencies for frontend coverage\n        run: bun run mono:build\n',
          ''
        )
      );
    });
    expect(run(directory).output).toContain(
      'Coverage job must build workspace package dependencies before frontend patch coverage'
    );
  });

  it('fails when Codecov or Sonar return as separate GitHub Actions jobs', () => {
    expect.hasAssertions();

    const directory = fixture((root) => {
      const file = path.join(root, '.github/workflows/ci.yml');
      fs.writeFileSync(
        file,
        `${fs.readFileSync(file, 'utf8')}\n  codecov:\n    runs-on: ubuntu-latest\n  sonarqube:\n    runs-on: ubuntu-latest\n`
      );
    });
    expect(run(directory).output).toContain('must run inside the coverage job');
  });

  it('fails when the Sonar scanner partial-clone guard is removed', () => {
    expect.hasAssertions();

    const directory = fixture((root) => {
      const file = path.join(root, '.github/workflows/ci.yml');
      fs.writeFileSync(
        file,
        fs.readFileSync(file, 'utf8').replace('sonar-scanner -Dsonar.scm.disabled=true', 'sonar-scanner')
      );
    });
    expect(run(directory).output).toContain('sonar-scanner -Dsonar\\.scm\\.disabled=true');
  });

  it('fails when GitHub Actions stops using the dedicated SonarCloud secret', () => {
    expect.hasAssertions();

    const directory = fixture((root) => {
      const file = path.join(root, '.github/workflows/ci.yml');
      fs.writeFileSync(
        file,
        fs.readFileSync(file, 'utf8').replace(/secrets\.SONARCLOUD_TOKEN/g, 'secrets.SONAR_TOKEN')
      );
    });
    expect(run(directory).output).toContain('secrets\\.SONARCLOUD_TOKEN');
  });

  it('fails when no job can access the environment-scoped secrets', () => {
    expect.hasAssertions();

    const directory = fixture((root) => {
      const file = path.join(root, '.github/workflows/ci.yml');
      // Every binding: sync-changelog also reads the "env vars" environment
      // (CHANGELOG_GH_TOKEN), so stripping only the first occurrence would
      // leave the check green and make this assertion vacuous.
      fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(/environment: env vars\n/g, ''));
    });
    expect(run(directory).output).toContain('environment:\\s*env vars');
  });

  it('fails when Sonar can scan binary assets as source files', () => {
    expect.hasAssertions();

    const directory = fixture((root) => {
      const file = path.join(root, 'sonar-project.properties');
      fs.writeFileSync(
        file,
        fs.readFileSync(file, 'utf8')
          .replace('sonar.sourceEncoding=UTF-8\n', '')
          .replace('**/*.png,', '')
      );
    });
    expect(run(directory).output).toContain('encoding-safe source scan marker');
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
    expect(text).toContain('GitHub Actions');
    expect(text).toContain('CircleCI is enabled');
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
