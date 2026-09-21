/* eslint-disable no-console */
/**
 * JUM-845 — fail closed when packaged templates drift from the seeds at HEAD.
 *
 * Compares packages/cli-init/templates/ (+ templates.manifest.json) to what
 * build-templates.js would produce from apps/backend-template and apps/frontend.
 * Wired into root `ci:gate` via `bun run cli:check-template-freshness`.
 */
const fs = require('node:fs');
const path = require('node:path');
const {
  DEFAULT_EXCLUSIONS,
  REPO_ROOT,
  SEEDS,
  buildManifest,
  collectExpectedFiles,
  isExcluded,
  resolveSourceCommit,
  sha256File
} = require('./build-templates');

function walkFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(absolute, out);
    } else if (entry.isFile() || entry.isSymbolicLink()) {
      out.push(absolute);
    }
  }
  return out;
}

function readCommittedTemplates(packageDir, exclusions = DEFAULT_EXCLUSIONS) {
  const templatesDir = path.join(packageDir, 'templates');
  /** @type {Map<string, string>} */
  const files = new Map();
  if (!fs.existsSync(templatesDir)) return files;

  for (const absolute of walkFiles(templatesDir)) {
    const relative = path.relative(templatesDir, absolute).replace(/\\/g, '/');
    const seedRelative = relative.replace(/^(backend|frontend)\//, '');
    if (isExcluded(seedRelative, exclusions) || isExcluded(relative, exclusions)) {
      continue;
    }
    files.set(relative, sha256File(absolute));
  }
  return files;
}

function readManifest(manifestPath) {
  if (!fs.existsSync(manifestPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch {
    return { __parseError: 'invalid JSON' };
  }
}

/**
 * @returns {string[]} human-readable failure lines (empty when green)
 */
function validateTemplateFreshness(root = REPO_ROOT, options = {}) {
  const packageDir = options.packageDir || path.join(root, 'packages', 'cli-init');
  const manifestPath = options.manifestPath || path.join(packageDir, 'templates.manifest.json');
  const exclusions = options.exclusions || DEFAULT_EXCLUSIONS;
  const failures = [];

  for (const seedRel of Object.values(SEEDS)) {
    if (!fs.existsSync(path.join(root, seedRel))) {
      failures.push(`[cli-init template-freshness] missing seed: ${seedRel}`);
    }
  }
  if (failures.length > 0) return failures;

  let expected;
  try {
    expected = collectExpectedFiles(root, exclusions);
  } catch (error) {
    return [`[cli-init template-freshness] ${error instanceof Error ? error.message : String(error)}`];
  }

  const actual = readCommittedTemplates(packageDir, exclusions);
  const expectedPaths = new Set(expected.keys());
  const actualPaths = new Set(actual.keys());

  for (const templatePath of [...expectedPaths].sort((left, right) => left.localeCompare(right))) {
    if (!actualPaths.has(templatePath)) {
      failures.push(
        `[cli-init template-freshness] missing packaged file: templates/${templatePath}`
        + ' — run `bun run cli:build-templates`'
      );
      continue;
    }
    const want = expected.get(templatePath).sha256;
    const got = actual.get(templatePath);
    if (want !== got) {
      failures.push(
        `[cli-init template-freshness] hash drift: templates/${templatePath}`
        + ` (expected ${want.slice(0, 12)}…, got ${got.slice(0, 12)}…)`
        + ' — run `bun run cli:build-templates`'
      );
    }
  }

  for (const templatePath of [...actualPaths].sort((left, right) => left.localeCompare(right))) {
    if (!expectedPaths.has(templatePath)) {
      failures.push(
        `[cli-init template-freshness] unexpected packaged file: templates/${templatePath}`
        + ' — run `bun run cli:build-templates`'
      );
    }
  }

  const manifest = readManifest(manifestPath);
  if (!manifest) {
    failures.push(
      '[cli-init template-freshness] missing packages/cli-init/templates.manifest.json'
      + ' — run `bun run cli:build-templates`'
    );
    return failures;
  }
  if (manifest.__parseError) {
    failures.push(
      `[cli-init template-freshness] unreadable templates.manifest.json: ${manifest.__parseError}`
    );
    return failures;
  }

  const sourceCommit = options.sourceCommit || resolveSourceCommit(root);
  const expectedManifest = buildManifest(expected, sourceCommit, exclusions);

  // Manifest must describe the same file set and hashes the seeds produce.
  // sourceCommit is recorded at build time; freshness is content, not tip SHA.
  const manifestFiles = manifest.files && typeof manifest.files === 'object'
    ? manifest.files
    : null;
  if (!manifestFiles) {
    failures.push('[cli-init template-freshness] templates.manifest.json missing files map');
    return failures;
  }

  for (const [templatePath, meta] of Object.entries(expectedManifest.files)) {
    const recorded = manifestFiles[templatePath];
    if (!recorded) {
      failures.push(
        `[cli-init template-freshness] manifest missing entry: ${templatePath}`
        + ' — run `bun run cli:build-templates`'
      );
      continue;
    }
    const recordedHash = typeof recorded === 'string' ? recorded : recorded.sha256;
    if (recordedHash !== meta.sha256) {
      failures.push(
        `[cli-init template-freshness] manifest hash drift: ${templatePath}`
        + ' — run `bun run cli:build-templates`'
      );
    }
  }

  for (const templatePath of Object.keys(manifestFiles).sort((left, right) => left.localeCompare(right))) {
    if (!expectedManifest.files[templatePath]) {
      failures.push(
        `[cli-init template-freshness] manifest has stale entry: ${templatePath}`
        + ' — run `bun run cli:build-templates`'
      );
    }
  }

  return failures;
}

function run(root = REPO_ROOT, options = {}) {
  const failures = validateTemplateFreshness(root, options);
  if (failures.length > 0) {
    failures.forEach((line) => console.error(line));
    return 1;
  }
  console.log(
    'CLI template freshness check passed: packaged templates match seeds at HEAD.'
  );
  return 0;
}

if (require.main?.filename === __filename) {
  try {
    process.exitCode = run();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

module.exports = {
  readCommittedTemplates,
  run,
  validateTemplateFreshness
};
