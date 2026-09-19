#!/usr/bin/env bun
/* eslint-disable no-console */
/**
 * Requirement 137 — workspace suite and tooling ownership placement.
 *
 * A suite must live in the workspace of the code it asserts. Monorepo gates
 * and their proof suites live under `ci-cd/` / `ci-cd/test`. Component-specific
 * scripts leave root `ci-cd/`. Dual-home package unit clones are forbidden.
 *
 * Fail-closed. Shrink-only allow-list at
 * `ci-cd/ownership-placement-allowlist.json`.
 */
const fs = require('node:fs');
const path = require('node:path');
const { runWhenEntryPoint } = require('./lib/entry-point.js');
const { listTestFiles, suiteRoots, byPath } = require('./lib/mapped-suites.js');

const ALLOWLIST_PATH = 'ci-cd/ownership-placement-allowlist.json';

const SKIP_DIRS = Object.freeze(['node_modules', 'dist', '.build', 'coverage', '.git']);

/** Apps that compose backend-template via `@src` by design (Req 137 §3). */
const SRC_COMPOSITION_HOMES = Object.freeze([
  'apps/backend-template',
  'apps/service-management-api'
]);

const FORBIDDEN_SM_HOMES = Object.freeze([
  'apps/backend-template/test/integration/ServiceManagement',
  'apps/backend-template/test/unit/ServiceManagement',
  'apps/backend-template/test/unit/ci-cd'
]);

/**
 * Resolve a repository root from CLI input without allowing path escape.
 * The candidate must exist, be a directory, and contain a root package.json.
 */
function resolveRepoRoot(candidate) {
  const resolved = path.resolve(String(candidate || ''));
  if (resolved.includes('\0')) {
    throw new TypeError('--root must not contain null bytes');
  }
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
    throw new TypeError(`--root is not a directory: ${resolved}`);
  }
  const manifest = path.join(resolved, 'package.json');
  if (!fs.existsSync(manifest)) {
    throw new TypeError(`--root must be the repository root (missing package.json): ${resolved}`);
  }
  return resolved;
}

/** Join `rel` under `root` and reject any result that escapes the root. */
function safeJoin(root, rel) {
  const base = path.resolve(root);
  const target = path.resolve(base, rel);
  const prefix = base.endsWith(path.sep) ? base : `${base}${path.sep}`;
  if (target !== base && !target.startsWith(prefix)) {
    throw new TypeError(`path escapes repository root: ${rel}`);
  }
  return target;
}

function parseArgs(argv) {
  const out = { changed: null, writeAllowlist: false, root: process.cwd() };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--changed') {
      const next = argv[i + 1] || '';
      out.changed = next.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
      i += 1;
    } else if (arg === '--write-allowlist') {
      out.writeAllowlist = true;
    } else if (arg === '--root') {
      out.root = resolveRepoRoot(argv[++i] || process.cwd());
    }
  }
  return out;
}

function listFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (SKIP_DIRS.includes(entry.name)) return [];
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? listFiles(full) : [full];
  });
}

function discoverWorkspaces(root) {
  const workspaces = [];
  for (const top of ['apps', 'packages']) {
    const base = path.join(root, top);
    if (!fs.existsSync(base)) continue;
    for (const entry of fs.readdirSync(base, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const rel = `${top}/${entry.name}`;
      if (fs.existsSync(path.join(root, rel, 'package.json'))) {
        workspaces.push(rel);
      }
    }
  }
  workspaces.push('ci-cd');
  return workspaces.sort(byPath);
}

function suiteHome(rel) {
  if (rel.startsWith('ci-cd/test/')) return 'ci-cd';
  const app = /^apps\/([^/]+)\//.exec(rel);
  if (app) return `apps/${app[1]}`;
  const pkg = /^packages\/([^/]+)\//.exec(rel);
  if (pkg) return `packages/${pkg[1]}`;
  return null;
}

/** Drop block and line comments so prose path mentions are not SUTs. */
function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function isConfigOnlyBackendTemplatePin(contents) {
  const refs = contents.match(/apps\/backend-template\/[^'"`\s)]+/g) || [];
  return (
    refs.length > 0
    && refs.every((ref) => ref.startsWith('apps/backend-template/src/config'))
  );
}

function addImportishWorkspaceHits(asserted, contents, home, workspaces) {
  for (const ws of workspaces) {
    if (ws === home) continue;
    if (
      home === 'apps/service-management'
      && ws === 'apps/backend-template'
      && isConfigOnlyBackendTemplatePin(contents)
    ) {
      continue;
    }
    const needle = ws.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const importish = new RegExp(
      `(?:require\\(\\s*|from\\s+|jest\\.mock\\(\\s*)['"\`]${needle}(/|['"\`])`
    );
    if (importish.test(contents)) asserted.add(ws);
  }
}

function addDeepPackageHits(asserted, contents) {
  const deepRe = /(?:require\(|from\s+|jest\.mock\()\s*['"]packages\/([^/'"]+)\/src\//g;
  let match = deepRe.exec(contents);
  while (match !== null) {
    asserted.add(`packages/${match[1]}`);
    match = deepRe.exec(contents);
  }
  const mockRe = /jest\.mock\(\s*['"]packages\/([^/'"]+)\//g;
  match = mockRe.exec(contents);
  while (match !== null) {
    asserted.add(`packages/${match[1]}`);
    match = mockRe.exec(contents);
  }
}

function addSrcAliasHits(asserted, contents, home) {
  const usesSrc = /(?:from\s+|require\(|jest\.mock\()\s*['"]@src\//.test(contents);
  if (usesSrc && !SRC_COMPOSITION_HOMES.includes(home)) {
    asserted.add('apps/backend-template');
  }
}

/**
 * Infer the primary SUT workspace from path heuristics and file contents.
 * Conservative: flag clear foreign homes; consumer `@jumentix/*` alone is OK.
 * Comments and prose path mentions are ignored. `ci-cd/test` may name any
 * workspace as gate fixture subject matter without asserting it as SUT.
 */
function inferAssertedWorkspaces(rel, rawContents, workspaces) {
  const asserted = new Set();
  const home = suiteHome(rel);
  const contents = stripComments(rawContents);

  if (/\/ServiceManagement\//.test(rel) && home !== 'apps/service-management') {
    asserted.add('apps/service-management');
  }

  // Monorepo gate suites live under ci-cd and describe the whole tree.
  if (rel.startsWith('ci-cd/test/')) {
    asserted.add('ci-cd');
    return [...asserted].sort(byPath);
  }

  addImportishWorkspaceHits(asserted, contents, home, workspaces);

  if (home && home.startsWith('apps/') && /require\(['"](?:\.\.\/)+ci-cd\//.test(contents)) {
    asserted.add('ci-cd');
  }

  addDeepPackageHits(asserted, contents);
  addSrcAliasHits(asserted, contents, home);

  return [...asserted].sort(byPath);
}

function loadAllowlist(root) {
  const file = safeJoin(root, ALLOWLIST_PATH);
  if (!fs.existsSync(file)) return [];
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  const entries = Array.isArray(raw) ? raw : raw.entries;
  if (!Array.isArray(entries)) {
    throw new TypeError(`${ALLOWLIST_PATH} must be an array or { entries: [] }`);
  }
  return entries;
}

function validateAllowlistShape(entries) {
  const failures = [];
  for (const entry of entries) {
    for (const field of ['suite', 'assertsWorkspace', 'reason', 'issue']) {
      if (!entry?.[field] || typeof entry[field] !== 'string') {
        failures.push(`allow-list entry missing ${field}: ${JSON.stringify(entry)}`);
      }
    }
  }
  return failures;
}

function collectSuites(root) {
  const roots = suiteRoots(root);
  const allRoots = [...new Set([...roots, 'ci-cd/test'])];
  return allRoots
    .flatMap((relRoot) => listTestFiles(path.join(root, relRoot), root))
    .sort(byPath);
}

function collectSuiteViolations(root, suites, allowKeys, workspaces, changed) {
  const violations = [];
  for (const suite of suites) {
    if (changed && changed.length > 0 && !changed.includes(suite)) continue;

    const abs = safeJoin(root, suite);
    if (!fs.existsSync(abs)) continue;
    const contents = fs.readFileSync(abs, 'utf8');
    const home = suiteHome(suite);
    if (!home) {
      violations.push({
        suite,
        home: null,
        assertsWorkspace: 'unknown',
        rule: 'unscoped-suite-home'
      });
      continue;
    }

    const asserted = inferAssertedWorkspaces(suite, contents, workspaces);
    for (const assertsWorkspace of asserted) {
      if (assertsWorkspace === home) continue;
      const key = `${suite}::${assertsWorkspace}`;
      if (allowKeys.has(key)) continue;
      violations.push({
        suite,
        home,
        assertsWorkspace,
        rule: 'suite-home-vs-sut'
      });
    }
  }
  return violations;
}

function collectForbiddenHomeViolations(root) {
  const violations = [];
  for (const home of FORBIDDEN_SM_HOMES) {
    if (fs.existsSync(path.join(root, home))) {
      violations.push({
        suite: home,
        home: 'apps/backend-template',
        assertsWorkspace: 'apps/service-management',
        rule: 'forbidden-sm-under-backend-template'
      });
    }
  }
  return violations;
}

function findViolations(root, options = {}) {
  const workspaces = discoverWorkspaces(root);
  const allowlist = options.allowlist || loadAllowlist(root);
  const shapeFailures = validateAllowlistShape(allowlist);
  const suites = collectSuites(root);
  const allowKeys = new Set(
    allowlist.map((e) => `${e.suite}::${e.assertsWorkspace}`)
  );

  const violations = [
    ...collectSuiteViolations(root, suites, allowKeys, workspaces, options.changed),
    ...collectForbiddenHomeViolations(root)
  ];

  for (const entry of allowlist) {
    if (!fs.existsSync(path.join(root, entry.suite))) {
      shapeFailures.push(
        `allow-list stale: suite missing on disk: ${entry.suite} (${entry.issue})`
      );
    }
  }

  return { violations, shapeFailures, allowlist, suites };
}

function formatViolation(v) {
  return `${v.suite} → asserts ${v.assertsWorkspace} (home ${v.home || '∅'}; rule ${v.rule})`;
}

function writeAllowlistSnapshot(root, violations) {
  const entries = violations.map((v) => ({
    suite: v.suite,
    assertsWorkspace: v.assertsWorkspace,
    reason: 'seeded during epic JUM-824 ownership placement; shrink only',
    issue: 'JUM-826'
  }));
  const seen = new Set();
  const unique = [];
  for (const e of entries) {
    const key = `${e.suite}::${e.assertsWorkspace}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(e);
  }
  unique.sort((a, b) => byPath(a.suite, b.suite) || byPath(a.assertsWorkspace, b.assertsWorkspace));
  fs.writeFileSync(
    safeJoin(root, ALLOWLIST_PATH),
    `${JSON.stringify(unique, null, 2)}\n`
  );
  console.log(`[ownership] wrote ${unique.length} allow-list entries to ${ALLOWLIST_PATH}`);
}

function run(root = process.cwd(), options = {}) {
  const result = findViolations(root, {
    ...options,
    allowlist: options.writeAllowlist ? [] : options.allowlist
  });
  const { violations, shapeFailures } = result;

  if (options.writeAllowlist) {
    writeAllowlistSnapshot(root, violations);
    return 0;
  }

  for (const failure of shapeFailures) console.error(`[ownership] ${failure}`);
  for (const v of violations) console.error(`[ownership] ${formatViolation(v)}`);

  if (shapeFailures.length || violations.length) {
    console.error(
      `[ownership] ${violations.length} placement violation(s), ${shapeFailures.length} allow-list error(s)`
    );
    return 1;
  }

  console.log('[ownership] placement check passed');
  return 0;
}

function main(argv = process.argv) {
  const args = parseArgs(argv);
  return run(args.root, {
    changed: args.changed,
    writeAllowlist: args.writeAllowlist
  });
}

runWhenEntryPoint({ caller: module, execute: main });

module.exports = {
  ALLOWLIST_PATH,
  SRC_COMPOSITION_HOMES,
  collectSuites,
  findViolations,
  inferAssertedWorkspaces,
  loadAllowlist,
  main,
  parseArgs,
  resolveRepoRoot,
  run,
  safeJoin,
  stripComments,
  suiteHome
};
