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
  return markdown
    .split('\n')
    .filter((line) => line.trimStart().startsWith('[!['))
    .map((line) => line.slice(line.lastIndexOf('](') + 2).replace(/\)$/, ''))
    .map((target) => target.replace('./LICENSE.pt-BR.md', './LICENSE.md'))
    .sort((left, right) => left.localeCompare(right));
}

describe('public README quality links', () => {
  it('shows public GitHub Actions and Codecov metrics for dev and main', () => {
    expect.hasAssertions();

    for (const branch of ['dev', 'main']) {
      expect(readme).toContain(`https://github.com/web2solutions/Jumentix/actions/workflows/ci.yml/badge.svg?branch=${branch}`);
      expect(readme).toContain(`https://codecov.io/gh/web2solutions/Jumentix/branch/${branch}/graph/badge.svg`);
      expect(readme).toContain(`https://codecov.io/gh/web2solutions/Jumentix/branch/${branch}/graphs/tree.svg`);
      expect(readme).toContain(`https://app.codecov.io/github/web2solutions/Jumentix/tree/${branch}`);
    }
  });

  it('shows SonarCloud quality and reliability badges for dev and main', () => {
    expect.hasAssertions();

    for (const branch of ['dev', 'main']) {
      expect(readme).toContain(`metric=alert_status&branch=${branch}`);
      expect(readme).toContain(`metric=reliability_rating&branch=${branch}`);
      expect(readme).toContain(`https://sonarcloud.io/summary/new_code?id=web2solutions_Jumentix&branch=${branch}`);
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
      'Requirement `',
      'CircleCI'
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
