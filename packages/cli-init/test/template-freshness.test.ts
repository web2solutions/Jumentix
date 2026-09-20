/* eslint-disable @typescript-eslint/no-var-requires, jest/require-hook */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const {
  DEFAULT_EXCLUSIONS,
  buildTemplates,
  isExcluded,
  matchGlob
} = require('../scripts/build-templates');
const { validateTemplateFreshness } = require('../scripts/check-template-freshness');

function writeFile(root: string, relative: string, contents: string) {
  const absolute = path.join(root, relative);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, contents, 'utf8');
}

function fixtureRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'jum845-templates-'));
  writeFile(root, 'apps/backend-template/package.json', '{"name":"backend-seed"}\n');
  writeFile(root, 'apps/backend-template/src/index.ts', 'export const backend = 1;\n');
  writeFile(root, 'apps/backend-template/OASdoc/index.html', '<html>skip</html>\n');
  writeFile(root, 'apps/backend-template/seed/accounts-api-large.json', '{"heavy":true}\n');
  writeFile(root, 'apps/frontend/package.json', '{"name":"frontend-seed"}\n');
  writeFile(root, 'apps/frontend/src/main.ts', 'export const frontend = 1;\n');
  writeFile(root, 'apps/frontend/node_modules/left-pad/index.js', 'module.exports = 1;\n');
  writeFile(root, 'apps/frontend/cypress/videos/run.mp4', 'fake-video\n');
  writeFile(root, 'apps/frontend/template/leftover.ts', 'export {}\n');
  return root;
}

describe('template packaging exclusions (JUM-845)', () => {
  it('matches OASdoc and Cypress video exclusion globs', () => {
    expect.hasAssertions();
    expect(matchGlob('**/OASdoc/**', 'OASdoc/index.html')).toBe(true);
    expect(matchGlob('**/cypress/videos/**', 'cypress/videos/run.mp4')).toBe(true);
    expect(matchGlob('**/seed/*-large.json', 'seed/accounts-api-large.json')).toBe(true);
    expect(isExcluded('src/index.ts', DEFAULT_EXCLUSIONS)).toBe(false);
    expect(isExcluded('OASdoc/index.html', DEFAULT_EXCLUSIONS)).toBe(true);
  });

  it('excludes node_modules and frontend template leftovers', () => {
    expect.hasAssertions();
    expect(isExcluded('node_modules/left-pad/index.js', DEFAULT_EXCLUSIONS)).toBe(true);
    expect(isExcluded('template/leftover.ts', DEFAULT_EXCLUSIONS)).toBe(true);
  });
});

describe('template freshness gate (JUM-845)', () => {
  it('passes after a clean build against the fixture seeds', () => {
    expect.hasAssertions();
    const root = fixtureRoot();
    try {
      const built = buildTemplates(root, { sourceCommit: 'fixture-commit' });
      expect(built.fileCount).toBeGreaterThan(0);
      expect(fs.existsSync(path.join(root, 'packages/cli-init/templates/backend/package.json'))).toBe(true);
      expect(fs.existsSync(path.join(root, 'packages/cli-init/templates/backend/OASdoc/index.html'))).toBe(false);
      expect(
        validateTemplateFreshness(root, { sourceCommit: 'fixture-commit' })
      ).toStrictEqual([]);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('omits node_modules and Cypress videos from the packaged tree', () => {
    expect.hasAssertions();
    const root = fixtureRoot();
    try {
      buildTemplates(root, { sourceCommit: 'fixture-commit' });
      expect(
        fs.existsSync(path.join(root, 'packages/cli-init/templates/frontend/node_modules/left-pad/index.js'))
      ).toBe(false);
      expect(
        fs.existsSync(path.join(root, 'packages/cli-init/templates/frontend/cypress/videos/run.mp4'))
      ).toBe(false);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails closed when a packaged template drifts from the seed (red path)', () => {
    expect.hasAssertions();
    const root = fixtureRoot();
    try {
      buildTemplates(root, { sourceCommit: 'fixture-commit' });

      const drifted = path.join(
        root,
        'packages/cli-init/templates/backend/src/index.ts'
      );
      fs.writeFileSync(drifted, 'export const backend = "stale";\n', 'utf8');

      const failures = validateTemplateFreshness(root, { sourceCommit: 'fixture-commit' });
      const joined = failures.join('\n');

      expect(failures.length).toBeGreaterThan(0);
      expect(joined).toContain('hash drift');
      expect(joined).toContain('backend/src/index.ts');
      expect(joined).toContain('bun run cli:build-templates');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
