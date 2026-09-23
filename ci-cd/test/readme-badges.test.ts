import fs from 'node:fs';
import path from 'node:path';

/**
 * README badges must point at the services this repository actually uses.
 *
 * A stale badge is a uniquely bad kind of wrong: it renders, it looks
 * authoritative, and it reports the health of something else entirely. Three
 * were live before this suite existed —
 *
 *   - SonarCloud badges pointed at the wrong project key,
 *     the pre-migration project key, so they had been showing another project's
 *     quality gate since the move to `web2solutions/Jumentix` (Requirement 103);
 *   - a Snyk badge remained after Snyk was retired in JUM-540, advertising a
 *     scanner the repository no longer runs;
 *   - a `node 22.x` badge implied Node is the runtime, which Requirement 096
 *     ended — Bun is, and Node survives only as a consumer-facing compatibility
 *     target.
 *
 * Nothing failed while any of that was true, which is exactly why it is pinned
 * here rather than left to review.
 */

const repoRoot = path.resolve(__dirname, '../..');
const readme = fs.readFileSync(path.join(repoRoot, 'README.md'), 'utf8');
const ptReadme = fs.readFileSync(path.join(repoRoot, 'README.pt-BR.md'), 'utf8');

function badgeTargets(markdown: string): string[] {
  return [...markdown.matchAll(/\[!\[[^\]]*\]\([^)]*\)\]\(([^)]+)\)/g)]
    .map((match) => match[1])
    .map((target) => target.replace('./LICENSE.pt-BR.md', './LICENSE.md'))
    .sort((left, right) => left.localeCompare(right));
}

describe('public README quality links', () => {
  it('shows public CircleCI and Codecov metrics for dev and main', () => {
    expect.hasAssertions();

    for (const branch of ['dev', 'main']) {
      expect(readme).toContain(`https://circleci.com/gh/web2solutions/Jumentix.svg?style=shield&branch=${branch}`);
      expect(readme).toContain(`https://circleci.com/gh/web2solutions/Jumentix/tree/${branch}`);
      expect(readme).toContain(`https://codecov.io/gh/web2solutions/Jumentix/branch/${branch}/graph/badge.svg`);
      expect(readme).toContain(`https://codecov.io/gh/web2solutions/Jumentix/branch/${branch}/graphs/tree.svg`);
      expect(readme).toContain(`https://app.codecov.io/github/web2solutions/Jumentix/tree/${branch}`);
    }
  });

  it('keeps the Codecov grids side by side', () => {
    expect.hasAssertions();

    expect(readme).toContain(
      '| [![Codecov Grid for dev](https://codecov.io/gh/web2solutions/Jumentix/branch/dev/graphs/tree.svg)](https://app.codecov.io/github/web2solutions/Jumentix/tree/dev) | [![Codecov Grid for main](https://codecov.io/gh/web2solutions/Jumentix/branch/main/graphs/tree.svg)](https://app.codecov.io/github/web2solutions/Jumentix/tree/main) |'
    );
    expect(ptReadme).toContain(
      '| [![Codecov Grid para dev](https://codecov.io/gh/web2solutions/Jumentix/branch/dev/graphs/tree.svg)](https://app.codecov.io/github/web2solutions/Jumentix/tree/dev) | [![Codecov Grid para main](https://codecov.io/gh/web2solutions/Jumentix/branch/main/graphs/tree.svg)](https://app.codecov.io/github/web2solutions/Jumentix/tree/main) |'
    );
  });

  it('shows only SonarCloud badges backed by an available branch measure', () => {
    expect.hasAssertions();

    const documents = [readme, ptReadme];
    expect({
      branchDashboards: ['dev', 'main'].every((branch) => documents.every((document) => document.includes(`https://sonarcloud.io/summary/new_code?id=web2solutions_Jumentix&branch=${branch}`))),
      devMetrics: ['alert_status', 'reliability_rating', 'coverage'].every((metric) => documents.every((document) => document.includes(`metricKeys%3D${metric}%26branch%3Ddev`))),
      mainMetrics: ['alert_status', 'reliability_rating'].every((metric) => documents.every((document) => document.includes(`metric=${metric}&branch=main`))),
      missingMainCoverage: documents.every((document) => !document.includes('metric=coverage&branch=main'))
    }).toStrictEqual({
      branchDashboards: true,
      devMetrics: true,
      mainMetrics: true,
      missingMainCoverage: true
    });
  });

  it('puts the mascot and public website ahead of the repository details', () => {
    expect.hasAssertions();

    for (const document of [readme, ptReadme]) {
      expect(document).toContain('https://jumentix-website.vercel.app/brand/jumentix-mascot.png');
      expect(document).toContain('href="https://jumentix-website.vercel.app"');
    }
  });

  it('starts product users with the Jumentix CLI rather than repository development commands', () => {
    expect.hasAssertions();

    for (const document of [readme, ptReadme]) {
      expect({
        usesCli: document.includes('bun x github:web2solutions/Jumentix#dev'),
        choosesDev: document.includes('--git-branch=dev'),
        choosesRest: document.includes('--service-type=rest'),
        clonesRepository: document.includes('git clone https://github.com/web2solutions/Jumentix.git'),
        startsWorkspace: document.includes('bun run dev:express')
      }).toStrictEqual({
        usesCli: true,
        choosesDev: true,
        choosesRest: true,
        clonesRepository: false,
        startsWorkspace: false
      });
    }
  });

  it('keeps public runtime, repository, and platform badges in both README variants', () => {
    expect.hasAssertions();

    for (const badge of [
      'node%20compat-22.x',
      'repository-public',
      'Run%20with-Express',
      'Run%20with-Fastify',
      'Run%20on-Cloudflare%20Workers',
      'Run%20on-Vercel%20Functions',
      'StandWithUkraine/main/badges/StandWithUkraine.svg'
    ]) {
      expect(readme).toContain(badge);
      expect(ptReadme).toContain(badge);
    }
  });

  it('reflects the canonical MIT license in its badges and public copy', () => {
    expect.hasAssertions();

    for (const document of [readme, ptReadme]) {
      expect(document).toMatch(/licen[cs][ae]-MIT-blue/);
      expect(document).not.toContain('AGPL--3.0');
      expect(document).not.toContain('GNU Affero General Public License');
    }
  });

  it('keeps the README focused on public product information', () => {
    expect.hasAssertions();

    for (const term of [
      'Coverage and CI Map',
      'CODECOV_TOKEN',
      'JUMENTIX_ENABLE_SONAR',
      'test-map.json',
      'branch-gate',
      'Istanbul JSON',
      'LCOV evidence',
      'Firestore Database',
      'HISTORICAL-TRANSITIONS',
      'Requirement `'
    ]) {
      expect(readme).not.toContain(term);
      expect(ptReadme).not.toContain(term);
    }
  });

  it('uses the canonical repository and no retired repository slug', () => {
    expect.hasAssertions();

    expect(readme).toContain('web2solutions/Jumentix');
    expect(ptReadme).toContain('web2solutions/Jumentix');
    expect(readme).not.toContain('XpertMinds/Jumentix');
    expect(ptReadme).not.toContain('XpertMinds/Jumentix');
  });

  it('keeps the English and Portuguese badge destinations aligned', () => {
    expect.hasAssertions();

    expect(badgeTargets(ptReadme)).toStrictEqual(badgeTargets(readme));
  });

  it('links to public documentation, contribution guidance, and the license', () => {
    expect.hasAssertions();

    for (const heading of ['## Get Started', '## Guides and Documentation', '## Contributing', '## License']) {
      expect(readme).toContain(heading);
    }
    for (const file of [
      'documentation/README.md',
      'documentation/md/CONTRIBUTING-AND-TOOLING.md',
      'LICENSE.md'
    ]) {
      expect(fs.existsSync(path.join(repoRoot, file))).toBe(true);
    }
  });
});

describe('website realtime navigation metadata', () => {
  it('indexes the pt-BR realtime adapter pages shipped by the website', async () => {
    expect.hasAssertions();

    const { default: ptBrRealtimeMeta } = await import(
      path.join(repoRoot, 'apps/jumentix-website/content/pt-BR/jumentix/adapters/realtime/_meta')
    ) as { default: Record<string, string> };

    expect(ptBrRealtimeMeta).toStrictEqual({
      'grpc-api': 'API gRPC em tempo real',
      'websocket-api': 'API WebSocket em tempo real'
    });
  });
});
