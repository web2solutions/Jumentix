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

const repoRoot = path.resolve(__dirname, '../../../../..');
const readme = fs.readFileSync(path.join(repoRoot, 'README.md'), 'utf8');
/**
 * Every badge line, wherever it sits in the header.
 *
 * Slicing to the first blank line looked correct and captured only the title —
 * the badge block starts *after* a blank line — which made four assertions here
 * pass vacuously on their first run. Collecting the badge lines themselves
 * cannot drift that way.
 */
const badges = readme
  .split('\n')
  .filter((line) => line.trimStart().startsWith('[!['))
  .join('\n');

const sonarProperties = fs.readFileSync(
  path.join(repoRoot, 'sonar-project.properties'),
  'utf8'
);
const pinnedBunVersion = fs.readFileSync(path.join(repoRoot, '.bun-version'), 'utf8').trim();

describe('rEADME badges', () => {
  it('shows GitHub Actions for both long-lived branches', () => {
    expect.hasAssertions();

    expect.hasAssertions();
    for (const branch of ['dev', 'main']) {
      expect(readme).toContain(`https://github.com/web2solutions/Jumentix/actions/workflows/ci.yml/badge.svg?branch=${branch}`);
      expect(readme).toContain(`https://github.com/web2solutions/Jumentix/actions/workflows/ci.yml?query=branch%3A${branch}`);
    }
    for (const branch of ['dev', 'main']) {
      expect(readme).toContain(`https://dl.circleci.com/status-badge/img/gh/web2solutions/Jumentix/tree/${branch}.svg?style=svg`);
      expect(readme).toContain(`https://app.circleci.com/pipelines/github/web2solutions/Jumentix?branch=${branch}`);
    }
  });

  it('links SonarCloud dashboards through the public project badge endpoints', () => {
    expect.hasAssertions();

    expect.hasAssertions();
    const key = sonarProperties.match(/sonar\.projectKey=(\S+)/)?.[1];
    const expectedBadgeSlugs = [
      `sonarcloud.io/api/project_badges/measure?project=${key}&metric=alert_status`,
      `sonarcloud.io/api/project_badges/measure?project=${key}&metric=reliability_rating`,
      `sonarcloud.io/api/project_badges/measure?project=${key}&metric=coverage`
    ];

    expect(key).toBe('web2solutions_Jumentix');
    expect(badges).toContain(`sonarcloud.io/summary/new_code?id=${key}`);
    expect(expectedBadgeSlugs.every((slug) => badges.includes(slug))).toBe(true);
    expect(badges).not.toContain('web2solutions_aaa-typescript-boilerplate');
  });

  it('carries no badge for a retired service', () => {
    expect.hasAssertions();

    expect.hasAssertions();
    // Paid/unreliable providers were retired in favour of repository-owned gates.
    expect(badges).not.toContain('snyk.io');
    expect(badges).not.toContain('token=');
    expect(badges).not.toContain('badge/codecov-via%20CircleCI');
  });

  it('badges public Codecov coverage and links the file maps', () => {
    expect.hasAssertions();

    for (const branch of ['dev', 'main']) {
      expect(readme).toContain(`https://codecov.io/gh/web2solutions/Jumentix/branch/${branch}/graph/badge.svg`);
      expect(readme).toContain(`https://app.codecov.io/gh/web2solutions/Jumentix/tree/${branch}`);
    }
    expect(readme).toContain('Codecov file map for `dev`');
    expect(readme).toContain('Codecov file map for `main`');
  });

  it('restores the coverage map with every enforced threshold', () => {
    expect.hasAssertions();

    expect(readme).toContain('## Coverage and CI Map');
    expect(readme).toContain('| Codecov coverage |');
    expect(readme).toContain('| ≥ 99% | ≥ 99% | ≥ 99% | ≥ 90% | ≥ 99% |');
    expect(readme).toContain('Istanbul JSON and LCOV evidence');
  });

  it('names Bun as the runtime at the pinned version', () => {
    expect.hasAssertions();

    expect.hasAssertions();
    // Requirement 096: Bun is the sole internal runtime. A badge claiming Node
    // misstates what the repository runs on.
    expect(badges).toContain(`badge/bun-${pinnedBunVersion}`);
  });

  it('presents Node as a compatibility target, not as the runtime', () => {
    expect.hasAssertions();

    expect.hasAssertions();
    // Node survives as a declared consumer-facing compatibility target
    // (Requirement 096 §4), which is a materially different claim.
    expect(badges).toContain('node%20compat');
    expect(badges).not.toMatch(/badge\/node-\d/);
  });

  it('keeps the badge list free of dead links to the deprecated origin', () => {
    expect.hasAssertions();

    expect.hasAssertions();
    // Requirement 103: the canonical repository lives under `web2solutions`.
    expect(badges).not.toContain('XpertMinds/Jumentix');
  });
});

/**
 * Every HTTP adapter shipped, and the badge that advertises it.
 *
 * The list is the source of truth in both directions: a new adapter without a
 * badge fails here, and a badge for an adapter that does not exist fails too.
 * That two-way check is the point — a badge nobody can trace back to code is
 * how the SonarCloud badges ended up pointing at another project for months.
 */
const ADAPTERS: readonly { dir: string; badge: string }[] = [
  { dir: 'express', badge: 'Run%20with-Express' },
  { dir: 'fastify', badge: 'Run%20with-Fastify' },
  { dir: 'restify', badge: 'Run%20with-Restify' },
  { dir: 'adonis-js', badge: 'Run%20with-AdonisJS' },
  { dir: 'feathers', badge: 'Run%20with-FeathersJS' },
  { dir: 'loopback', badge: 'Run%20with-LoopBack' },
  { dir: 'sails-js', badge: 'Run%20with-SailsJS' },
  { dir: 'derby-js', badge: 'Run%20with-DerbyJS' },
  { dir: 'total-js', badge: 'Run%20with-Total.js' },
  { dir: 'aws', badge: 'Run%20with-Serverless' },
  { dir: 'cloudflare-workers', badge: 'Cloudflare%20Workers' },
  { dir: 'vercel-functions', badge: 'Vercel%20Functions' }
];

/**
 * The dev script each adapter is started by.
 *
 * Mostly `dev:<dir>`, with three exceptions: `aws` is served by `dev:serverless`,
 * and the two platform targets keep their own names.
 */
const DEV_SCRIPT: Readonly<Record<string, string>> = {
  express: 'dev:express',
  fastify: 'dev:fastify',
  restify: 'dev:restify',
  'adonis-js': 'dev:adonis-js',
  feathers: 'dev:feathers',
  loopback: 'dev:loopback',
  'sails-js': 'dev:sails-js',
  'derby-js': 'dev:derby-js',
  'total-js': 'dev:total-js',
  aws: 'dev:serverless',
  'cloudflare-workers': 'dev:cloudflare-workers',
  'vercel-functions': 'dev:vercel-functions'
};

const adaptersDir = path.join(repoRoot, 'apps/backend-template/src/interface/HTTP/adapters');

describe('web framework badges', () => {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8')
  ) as { dependencies: Record<string, string>; scripts: Record<string, string> };

  it.each(ADAPTERS)('badges the $dir adapter', ({ badge }) => {
    expect.hasAssertions();
    expect(badges).toContain(badge);
  });

  it.each(ADAPTERS)('ships an adapter behind the $dir badge', ({ dir }) => {
    expect.hasAssertions();
    // The reverse direction: no badge may advertise something absent.
    expect(fs.existsSync(path.join(adaptersDir, dir))).toBe(true);
  });

  it('badges every adapter directory that exists', () => {
    expect.hasAssertions();

    expect.hasAssertions();
    // Catches the omission a hand-written list invites: a new adapter lands and
    // nobody remembers the README.
    const onDisk = fs.readdirSync(adaptersDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();

    expect(onDisk).toStrictEqual(ADAPTERS.map(({ dir }) => dir).sort());
  });

  it('declares the frameworks that are installed as real dependencies', () => {
    expect.hasAssertions();

    expect.hasAssertions();
    // Express, Fastify and Restify are declared and installed. Six other adapters
    // reference their frameworks but are tracked as gaps under Requirement 108 —
    // four have undeclared dependencies and cannot start, two swallow the require
    // and serve on Node's `http` instead. See ci-cd/check-http-adapter-authenticity.js
    // and Linear JUM-570. The badges stay because the owner chose to advertise the
    // adapters; the gaps are tracked rather than hidden.
    expect(manifest.dependencies.express).toBeDefined();
    expect(manifest.dependencies.fastify).toBeDefined();
    expect(manifest.dependencies.restify).toBeDefined();
  });

  it('has a dev script for every badged adapter', () => {
    expect.hasAssertions();

    expect.hasAssertions();
    // What makes "supported" checkable: each badge corresponds to something a
    // developer can actually run.
    const runnable = ADAPTERS
      .map(({ dir }) => DEV_SCRIPT[dir])
      .filter((script) => manifest.scripts[script] === undefined);

    expect(runnable).toStrictEqual([]);
  });

  it('carries no badge for hyper-express, which was dropped', () => {
    expect.hasAssertions();

    expect.hasAssertions();
    // Removed during the Bun migration: uWebSockets.js is not an N-API module,
    // so hyper-express cannot run on Bun at all.
    expect(badges).not.toContain('hyper-express');
    expect(badges).not.toContain('Hyper');
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

/**
 * The PT-BR README is a translation, not a separate document.
 *
 * Its badge block drifted badly while nothing checked it: 10 badges against the
 * English 25, both SonarCloud badges still on the pre-migration project key
 * `web2solutions_aaa-typescript-boilerplate`, no Bun badge, and none of the
 * twelve framework badges. Every assertion above ran only against README.md, so
 * the English file was pinned and its translation was not — the stale key this
 * suite was written to catch survived in the other language the whole time.
 *
 * Checking the badge *set* rather than individual badges is deliberate: a rule
 * per badge would have to be extended every time one is added, which is the same
 * manual step that let this drift in the first place.
 */
describe('readme badge parity across languages (Requirement 076)', () => {
  const ptReadme = fs.readFileSync(path.join(repoRoot, 'README.pt-BR.md'), 'utf8');
  const ptBadges = ptReadme
    .split('\n')
    .filter((line) => line.trimStart().startsWith('[!['))
    .join('\n');

  /**
   * Where a badge links, which is language-independent.
   *
   * The destination only, not the image URL: a shields.io badge encodes its
   * visible label in the image path, and that label is translated on purpose
   * ("Run with" -> "Rode com"). Comparing whole lines would report those
   * legitimate translations as drift and make the check useless.
   */
  const targets = (block: string) => block
    .split('\n')
    .map((line) => line.slice(line.lastIndexOf('](') + 2).replace(/\)$/, ''))
    .sort();

  it('badges the same services in both languages', () => {
    expect.hasAssertions();

    expect.hasAssertions();
    expect(targets(ptBadges)).toStrictEqual(targets(badges));
  });

  it('carries the current SonarCloud project key in the translation too', () => {
    expect.hasAssertions();

    expect.hasAssertions();
    // The specific regression: this suite existed and passed while the PT-BR
    // badges pointed at another project's quality gate.
    expect(ptBadges).not.toContain('web2solutions_aaa-typescript-boilerplate');
    expect(ptBadges).toContain('Jumentix');
  });

  it('does not translate Node, Bun, or framework names', () => {
    expect.hasAssertions();

    expect.hasAssertions();
    // The previous translation rendered Node as "Nó". Product names are proper
    // nouns; translating them makes the badge describe nothing.
    expect(ptBadges).not.toContain('Nó');
    expect(ptBadges).toContain('bun-1.3.13');
  });
});
