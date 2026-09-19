import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(__dirname, '../..');
const releaseGate = require(path.join(repoRoot, 'ci-cd/check-npm-package-release')) as {
  discoverPublishablePackages: (root: string) => string[];
  validateManifest: (manifest: Record<string, unknown>, directory: string) => string[];
};

describe('public npm package release policy', () => {
  it('selects only the canonical public Jumentix package cohort', () => {
    expect.hasAssertions();

    const packages = releaseGate.discoverPublishablePackages(repoRoot);
    const validationFailures = packages.flatMap((directory) => releaseGate.validateManifest(
      JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8')),
      directory
    ));
    expect({
      names: packages.map((directory) => JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8')).name),
      validationFailures
    }).toStrictEqual({
      names: ['@jumentix/cana', '@jumentix/cana-react', '@jumentix/cana-vue', '@jumentix/designer-core'],
      validationFailures: []
    });
  });

  it('keeps publication manual, main-only, and token-scoped in GitHub Actions', () => {
    expect.hasAssertions();

    const workflow = fs.readFileSync(path.join(repoRoot, '.github/workflows/npm-publish.yml'), 'utf8');
    expect({
      manual: workflow.includes('workflow_dispatch:'),
      mainOnly: workflow.includes('github.ref == \'refs/heads/main\''),
      protected: workflow.includes('environment: npm-publish'),
      artifactGate: workflow.includes('bun run npm:packages:check'),
      tokenMapping: /NODE_AUTH_TOKEN: \$\{\{ secrets\.NPM_JUMENTIX_CI_CD \}\}/.test(workflow),
      tokenEcho: /echo\s+.*NPM_JUMENTIX_CI_CD/.test(workflow)
    }).toStrictEqual({
      manual: true,
      mainOnly: true,
      protected: true,
      artifactGate: true,
      tokenMapping: true,
      tokenEcho: false
    });
  });
});
