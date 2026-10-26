/**
 * Dependabot pull requests must not start a Vercel build of the commercial site.
 *
 * Vercel treats exit 0 as "skip" and exit 1 as "build". Inverting either code
 * would deploy every dependency bump, or skip dev and main.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const script = path.join(scriptsDir, 'vercel-ignore-build.sh');
const vercelConfig = path.join(scriptsDir, '..', 'vercel.json');

function run(ref) {
  const env = { ...process.env };
  if (ref === undefined) delete env.VERCEL_GIT_COMMIT_REF;
  else env.VERCEL_GIT_COMMIT_REF = ref;
  return spawnSync('sh', [script], { env, encoding: 'utf8' });
}

describe('Vercel ignored build step for Dependabot', () => {
  it('skips Dependabot head refs', () => {
    expect.hasAssertions();

    const bun = run('dependabot/bun/dev/fastify/helmet-13.2.0');
    const npm = run('dependabot/npm_and_yarn/apps/frontend/template/dev/pinia-4.1.0');
    const qualified = run('refs/heads/dependabot/bun/dev/typescript-7.0.2');

    expect(bun.status).toBe(0);
    expect(bun.stdout).toContain('Skipping Vercel build');
    expect(npm.status).toBe(0);
    expect(qualified.status).toBe(0);
  });

  it('builds dev, main, task branches, and a ref that only mentions Dependabot', () => {
    expect.hasAssertions();

    expect(run('dev').status).toBe(1);
    expect(run('main').status).toBe(1);
    expect(run('grok/ci/skip-dependabot-vercel-build').status).toBe(1);
    expect(run('feature/dependabot-cleanup').status).toBe(1);
  });

  it('builds when the ref is unset so a CLI deploy still runs', () => {
    expect.hasAssertions();

    const result = run(undefined);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('VERCEL_GIT_COMMIT_REF is unset');
  });

  it('wires the skip script as the Vercel ignore command', () => {
    expect.hasAssertions();

    const config = JSON.parse(fs.readFileSync(vercelConfig, 'utf8'));

    expect(config.ignoreCommand).toBe('sh scripts/vercel-ignore-build.sh');
  });
});
