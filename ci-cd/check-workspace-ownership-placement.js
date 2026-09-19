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
 * Resolve a repository root for programmatic callers (tests).
 * CLI never accepts a path argument — always process.cwd() — so LLM-supplied
 * `--root` cannot reach filesystem APIs (jssecurity:S8707).
 */
function resolveRepoRoot(candidate) {
  const resolved = path.resolve(String(candidate || process.cwd()));
  if (resolved.includes('\0')) {
    throw new TypeError('repository root must not contain null bytes');
  }
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
    throw new TypeError(`repository root is not a directory: ${resolved}`);
  }
  const manifest = path.join(resolved, 'package.json');
  if (!fs.existsSync(manifest)) {
    throw new TypeError(`repository root missing package.json: ${resolved}`);
  }
  return resolved;
}

/** Join `rel` under `root` and reject any result that escapes the root. */
function safeJoin(root, rel) {
  const base = path.resolve(root);
  const target = path.resolve(base, rel);
  const relative = path.relative(base, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new TypeError(`path escapes repository root: ${rel}`);
  }
  return target;
}

function parseArgs(argv) {
  const out = { changed: null, writeAllowlist: false };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--changed') {
      const next = argv[i + 1] || '';
      out.changed = next.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
      i += 1;
    } else if (arg === '--write-allowlist') {
      out.writeAllowlist = true;
    } else if (arg === '--root') {
      // Deliberately ignored: accepting a CLI path reopens S8707. Use cwd.
      i += 1;
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
  let out = '';
  let i = 0;
  while (i < source.length) {
    if (source.startsWith('/*', i)) {
      const end = source.indexOf('*/', i + 2);
      i = end === -1 ? source.length : end + 2;
      continue;
    }
    if (source.startsWith('//', i) && (i === 0 || source[i - 1] !== ':')) {
      const end = source.indexOf('\n', i);
      i = end === -1 ? source.length : end;
      continue;
    }
    out += source[i];
    i += 1;
  }
  return out;
}

function isConfigOnlyBackendTemplatePin(contents) {
  const refs = contents.match(/apps\/backend-template\/[^'"`\s)]+/g) || [];
  return (
    refs.length > 0
    && refs.every((ref) => ref.startsWith('apps/backend-template/src/config'))
  );
}

function addImportishWorkspaceHits(asserted, contents, home, workspaces) {
  const lines = contents.split('\n');
  for (const ws of workspaces) {
    if (ws === home) continue;
    if (
      home === 'apps/service-management'
      && ws === 'apps/backend-template'
      && isConfigOnlyBackendTemplatePin(contents)
    ) {
      continue;
    }
    // Only count a direct quoted specifier after require/from/jest.mock —
    // not an indirect path.join(repoRoot, 'ci-cd', …) composition.
    const hit = lines.some((line) => (
      line.includes(`require('${ws}'`)
      || line.includes(`require('${ws}/`)
      || line.includes(`require("${ws}"`)
      || line.includes(`require("${ws}/`)
      || line.includes(`require(\`${ws}\``)
      || line.includes(`require(\`${ws}/`)
      || line.includes(`from '${ws}'`)
      || line.includes(`from '${ws}/`)
      || line.includes(`from "${ws}"`)
      || line.includes(`from "${ws}/`)
      || line.includes(`from \`${ws}\``)
      || line.includes(`from \`${ws}/`)
      || line.includes(`jest.mock('${ws}'`)
      || line.includes(`jest.mock('${ws}/`)
      || line.includes(`jest.mock("${ws}"`)
      || line.includes(`jest.mock("${ws}/`)
      || line.includes(`jest.mock(\`${ws}\``)
      || line.includes(`jest.mock(\`${ws}/`)
    ));
    if (hit) asserted.add(ws);
  }
}

function addDeepPackageHits(asserted, contents) {
  for (const line of contents.split('\n')) {
    if (!/(?:require\(|from\s+|jest\.mock\()/.test(line)) continue;
    const deep = /packages\/([^/'"]+)\/src\//.exec(line);
    if (deep) asserted.add(`packages/${deep[1]}`);
    const mock = /jest\.mock\(\s*['"]packages\/([^/'"]+)\//.exec(line);
    if (mock) asserted.add(`packages/${mock[1]}`);
  }
}

function lineUsesSrcAlias(line) {
  return /(?:from\s+|require\(|jest\.mock\()/.test(line)
    && (line.includes("'@src/") || line.includes('"@src/'));
}

function addSrcAliasHits(asserted, contents, home) {
  if (SRC_COMPOSITION_HOMES.includes(home)) return;
  if (contents.split('\n').some(lineUsesSrcAlias)) {
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

function pushForeignAssertions(violations, suite, home, asserted, allowKeys) {
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

    pushForeignAssertions(
      violations,
      suite,
      home,
      inferAssertedWorkspaces(suite, contents, workspaces),
      allowKeys
    );
  }
  return violations;
}

function collectForbiddenHomeViolations(root) {
  const violations = [];
  for (const home of FORBIDDEN_SM_HOMES) {
    if (fs.existsSync(safeJoin(root, home))) {
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
    if (!fs.existsSync(safeJoin(root, entry.suite))) {
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
  // CLI always scans process.cwd() — never a caller-supplied path (S8707).
  return run(process.cwd(), {
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
