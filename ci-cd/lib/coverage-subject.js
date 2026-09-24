/**
 * Shared coverage-subject predicate for patch coverage and selective frontend
 * coverage production. Kept in one place so exclusions cannot drift between
 * check-patch-coverage and needs-frontend-patch-coverage (Req 065).
 */
const fs = require('fs');
const path = require('path');
const { emitsNoJavaScript } = require('./emits-javascript.js');

// Cypress specs live under `**/cypress/**` / `*.cy.ts(js)` and are the
// instrument, not the subject — same false-green trap as `test/` / `*.test.ts`
// if counted. Generated browser bundles under `.browser-tests/` are the same.
const TEST_FILE = /(^|\/)(test|cypress|\.browser-tests)\/|\.test\.ts$|\.spec\.ts$|\.cy\.(ts|js)$/;
// Website `_meta.ts` files are navigation/content metadata. The website job
// validates their routes and publishability; Jest coverage cannot execute them.
const WEBSITE_CONTENT_META = /^apps\/jumentix-website\/content\/.*\/_meta\.ts$/;

// Istanbul accepts `ignore file` with an optional description before `*/`
// (used by Redis/broker adapters that point at their integration suites).
const ISTANBUL_IGNORE_FILE = /\/\*\s*istanbul\s+ignore\s+file\b/;

function loadCoverageIgnorePatterns(rootDir) {
  try {
    // eslint-disable-next-line global-require, import/no-dynamic-require
    const jestConfig = require(path.join(rootDir, 'jest.config.js'));
    return (jestConfig.coveragePathIgnorePatterns || [])
      .map((pattern) => new RegExp(pattern.replace('<rootDir>', rootDir)));
  } catch {
    // No config to read: measure everything rather than assume an exclusion.
    return [];
  }
}

/**
 * @param {string} file repository-relative path
 * @param {{ rootDir?: string, coverageIgnorePatterns?: RegExp[] }} [options]
 */
function isCoverageSubject(file, options = {}) {
  // Patch coverage only measures TypeScript sources (`*.ts`). JSON, Vue, and
  // other assets under apps/frontend must not force frontend:test:coverage
  // (version-bump release PRs change package.json only — JUM-889).
  if (!file.endsWith('.ts') || file.endsWith('.d.ts')) return false;
  if (TEST_FILE.test(file)) return false;
  if (WEBSITE_CONTENT_META.test(file)) return false;
  const rootDir = options.rootDir || process.cwd();
  const absolute = path.join(rootDir, file);
  const patterns = options.coverageIgnorePatterns
    || loadCoverageIgnorePatterns(rootDir);
  if (patterns.some((pattern) => pattern.test(absolute))) return false;
  if (!fs.existsSync(absolute)) return false;
  if (ISTANBUL_IGNORE_FILE.test(fs.readFileSync(absolute, 'utf8'))) return false;
  return !emitsNoJavaScript(absolute);
}

module.exports = {
  ISTANBUL_IGNORE_FILE,
  TEST_FILE,
  WEBSITE_CONTENT_META,
  isCoverageSubject,
  loadCoverageIgnorePatterns
};
