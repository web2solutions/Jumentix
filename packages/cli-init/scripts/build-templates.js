/* eslint-disable no-console */
/**
 * JUM-845 — package lean backend/frontend seed slices into the CLI.
 *
 * Copies apps/backend-template and apps/frontend into
 * packages/cli-init/templates/{backend,frontend}/ with exclusion globs so the
 * published CLI stays offline-capable and reasonably lean. Writes
 * templates.manifest.json (per-file sha256 + source commit).
 *
 * Templates are opaque data for the published CLI (Req 037 / 062): this script
 * runs at build/CI time only and must never be imported by runtime entrypoints.
 */
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const PACKAGE_DIR = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(PACKAGE_DIR, '..', '..');
const TEMPLATES_DIR = path.join(PACKAGE_DIR, 'templates');
const MANIFEST_PATH = path.join(PACKAGE_DIR, 'templates.manifest.json');
const GIT_LOCATION_VARIABLES = Object.freeze([
  'GIT_DIR',
  'GIT_WORK_TREE',
  'GIT_INDEX_FILE',
  'GIT_OBJECT_DIRECTORY',
  'GIT_ALTERNATE_OBJECT_DIRECTORIES',
  'GIT_COMMON_DIR',
  'GIT_NAMESPACE'
]);

const SEEDS = Object.freeze({
  backend: 'apps/backend-template',
  frontend: 'apps/frontend'
});

/**
 * Paths relative to each seed root that must not ship in the CLI package.
 * Keep this list the single source of truth for build and freshness check.
 */
const DEFAULT_EXCLUSIONS = Object.freeze([
  '**/.agents/**',
  '**/.claude/**',
  '**/.openclaude/**',
  '**/.DS_Store',
  '**/AGENTS.md',
  '**/CLAUDE.md',
  '**/node_modules/**',
  '**/coverage/**',
  '**/.nyc_output/**',
  '**/dist/**',
  '**/.build/**',
  '**/OASdoc/**',
  '**/AsyncAPIdoc/**',
  '**/template/**',
  '**/cypress/videos/**',
  '**/cypress/screenshots/**',
  '**/cypress/downloads/**',
  '**/test/**',
  '**/seed/*-large.json',
  '**/docker-compose-platform-services.yml'
]);

/**
 * Minimal glob matcher for the exclusion patterns above.
 * Supports `*` (no slash) and `**` (zero or more path segments).
 * Leading `**` + `/` is optional so patterns like OASdoc/** match at seed root.
 */
function matchGlob(pattern, posixPath) {
  const normalized = posixPath.replace(/\\/g, '/').replace(/^\.\//, '');
  const source = pattern.replace(/\\/g, '/');
  let out = '^';
  let i = 0;
  while (i < source.length) {
    if (source.startsWith('**/', i)) {
      out += '(?:.*/)?';
      i += 3;
      continue;
    }
    if (source.startsWith('**', i)) {
      out += '.*';
      i += 2;
      continue;
    }
    if (source[i] === '*') {
      out += '[^/]*';
      i += 1;
      continue;
    }
    const ch = source[i];
    if ('+.^${}()|[]\\'.includes(ch)) {
      out += `\\${ch}`;
    } else {
      out += ch;
    }
    i += 1;
  }
  out += '$';
  return new RegExp(out).test(normalized);
}

function isExcluded(relativePath, exclusions = DEFAULT_EXCLUSIONS) {
  const normalized = relativePath.replace(/\\/g, '/');
  return exclusions.some((pattern) => matchGlob(pattern, normalized));
}

function sha256Buffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function sha256File(filePath) {
  return sha256Buffer(fs.readFileSync(filePath));
}

function resolveSourceCommit(root = REPO_ROOT) {
  // Git invokes hooks with repository-location variables set. They would make
  // a lookup for a temporary non-repository resolve this repository's HEAD.
  const environment = { ...process.env };
  for (const variable of GIT_LOCATION_VARIABLES) delete environment[variable];

  try {
    return execFileSync('/usr/bin/git', ['rev-parse', 'HEAD'], {
      cwd: root,
      encoding: 'utf8',
      env: environment
    }).trim();
  } catch {
    return 'unknown';
  }
}

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

function stripExcludedFromTree(templatesDir, exclusions = DEFAULT_EXCLUSIONS) {
  for (const absolute of walkFiles(templatesDir)) {
    const relative = path.relative(templatesDir, absolute).replace(/\\/g, '/');
    // Paths are "backend/…" or "frontend/…"; exclusions are seed-relative.
    const seedRelative = relative.replace(/^(backend|frontend)\//, '');
    if (isExcluded(seedRelative, exclusions) || isExcluded(relative, exclusions)) {
      fs.rmSync(absolute, { force: true });
    }
  }
}

/**
 * Inventory of files that the build would produce, keyed by path relative to
 * templates/ (e.g. "backend/package.json").
 */
function collectExpectedFiles(root = REPO_ROOT, exclusions = DEFAULT_EXCLUSIONS) {
  /** @type {Map<string, { sourcePath: string, sha256: string }>} */
  const files = new Map();

  for (const [name, seedRel] of Object.entries(SEEDS)) {
    const seedRoot = path.join(root, seedRel);
    if (!fs.existsSync(seedRoot)) {
      throw new Error(`[cli-init templates] missing seed: ${seedRel}`);
    }
    for (const absolute of walkFiles(seedRoot)) {
      const relative = path.relative(seedRoot, absolute).replace(/\\/g, '/');
      if (isExcluded(relative, exclusions)) continue;
      const templatePath = `${name}/${relative}`;
      files.set(templatePath, {
        sourcePath: path.join(seedRel, relative).replace(/\\/g, '/'),
        sha256: sha256File(absolute)
      });
    }
  }

  return files;
}

/**
 * Versions of every public `@jumentix/*` workspace package, recorded so the
 * CLI pins each generated dependency to a version that is actually published
 * (JUM-902). Packages version independently (Requirement 060).
 */
function collectPackageVersions(root = REPO_ROOT) {
  const packagesDir = path.join(root, 'packages');
  const versions = {};
  for (const entry of fs.readdirSync(packagesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const manifestPath = path.join(packagesDir, entry.name, 'package.json');
    if (!fs.existsSync(manifestPath)) continue;
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    if (manifest.private || typeof manifest.name !== 'string' || !manifest.name.startsWith('@jumentix/')) continue;
    versions[manifest.name] = manifest.version;
  }
  return Object.fromEntries(Object.entries(versions).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

function buildManifest(expectedFiles, sourceCommit, exclusions = DEFAULT_EXCLUSIONS, packageVersions = {}) {
  const files = {};
  for (const [templatePath, meta] of [...expectedFiles.entries()].sort((a, b) => (
    a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0
  ))) {
    files[templatePath] = {
      sha256: meta.sha256,
      source: meta.sourcePath
    };
  }

  return {
    schemaVersion: 1,
    sourceCommit,
    exclusions: [...exclusions],
    seeds: { ...SEEDS },
    packageVersions,
    fileCount: Object.keys(files).length,
    files
  };
}

function rmrf(target) {
  fs.rmSync(target, { recursive: true, force: true });
}

function ensureParent(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

/**
 * Copy seed slices into templates/ and rewrite templates.manifest.json.
 * @returns {{ fileCount: number, sourceCommit: string, manifestPath: string }}
 */
function buildTemplates(root = REPO_ROOT, options = {}) {
  const exclusions = options.exclusions || DEFAULT_EXCLUSIONS;
  const packageDir = options.packageDir || path.join(root, 'packages', 'cli-init');
  const templatesDir = options.templatesDir || path.join(packageDir, 'templates');
  const manifestPath = options.manifestPath || path.join(packageDir, 'templates.manifest.json');
  const sourceCommit = options.sourceCommit || resolveSourceCommit(root);

  const expected = collectExpectedFiles(root, exclusions);

  rmrf(templatesDir);
  fs.mkdirSync(templatesDir, { recursive: true });

  for (const [templatePath, meta] of expected) {
    const from = path.join(root, meta.sourcePath);
    const to = path.join(templatesDir, templatePath);
    ensureParent(to);
    fs.copyFileSync(from, to);
  }

  // macOS (and some tools) may drop .DS_Store into freshly created trees.
  stripExcludedFromTree(templatesDir, exclusions);

  const manifest = buildManifest(expected, sourceCommit, exclusions, collectPackageVersions(root));
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  return {
    fileCount: expected.size,
    sourceCommit,
    manifestPath,
    templatesDir
  };
}

function run(root = REPO_ROOT) {
  const result = buildTemplates(root);
  console.log(
    `[cli-init templates] wrote ${result.fileCount} files from commit ${result.sourceCommit}`
  );
  console.log(`[cli-init templates] manifest: ${path.relative(root, result.manifestPath)}`);
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
  DEFAULT_EXCLUSIONS,
  MANIFEST_PATH,
  PACKAGE_DIR,
  REPO_ROOT,
  SEEDS,
  TEMPLATES_DIR,
  buildManifest,
  buildTemplates,
  collectExpectedFiles,
  collectPackageVersions,
  isExcluded,
  matchGlob,
  resolveSourceCommit,
  run,
  sha256Buffer,
  sha256File,
  stripExcludedFromTree
};
