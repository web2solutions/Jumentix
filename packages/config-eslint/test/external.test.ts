import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { join } from 'node:path';

import { fixturesRoot } from './helpers';

const EXTERNAL = `${fixturesRoot()}external`;
const REPO_ROOT = join(__dirname, '..', '..', '..');

function eslintEntrypoint(): string {
  // eslint's exports map does not expose ./bin/eslint.js; resolve the package
  // entry and walk to the bin sibling (works under bun test and Jest).
  const repoRequire = createRequire(join(REPO_ROOT, 'package.json'));
  return join(repoRequire.resolve('eslint'), '..', '..', 'bin', 'eslint.js');
}

function runEslint(target: string): { status: number | null; output: string } {
  const result = spawnSync(process.execPath, [eslintEntrypoint(), target], {
    cwd: EXTERNAL,
    encoding: 'utf8'
  });
  return {
    status: result.status,
    output: `${result.stdout ?? ''}${result.stderr ?? ''}`
  };
}

/**
 * External-consumption test (JUM-7): a throwaway project outside the
 * monorepo's path aliases imports the built `@jumentix/config-eslint`
 * through normal node resolution and lints a positive and a negative sample.
 */
describe('external consumption', () => {
  it('positive sample passes lint', () => {
    expect.hasAssertions();
    const ok = runEslint('src/ok.ts');
    expect(ok.output).toBe('');
    expect(ok.status).toBe(0);
  });

  it('negative sample fails lint with no-console', () => {
    expect.hasAssertions();
    const bad = runEslint('src/bad.ts');
    expect(bad.status).toBe(1);
    expect(bad.output).toContain('no-console');
  });
});
