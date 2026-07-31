#!/usr/bin/env bun
/* eslint-disable no-console */
/**
 * Honest workspace test cell (JUM-557).
 * - Packages with real *.test.* files run those tests.
 * - Packages declaring jumentix.testSurface=typecheck-only run typecheck and are
 *   recorded as typecheck verification (not unit-test green).
 * - Echo placeholders are rejected (false green).
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { isEntryPoint } = require('./lib/entry-point.js');

const PLACEHOLDER_RE = /echo\s+["'][^"']*(no tests yet|placeholder|pending|covered by)[^"']*["']/i;

function packageDirs(root) {
  const out = [];
  for (const base of ['packages']) {
    const abs = path.join(root, base);
    if (!fs.existsSync(abs)) continue;
    for (const name of fs.readdirSync(abs)) {
      const dir = path.join(abs, name);
      if (fs.existsSync(path.join(dir, 'package.json'))) out.push(dir);
    }
  }
  return out;
}

function hasTestFiles(dir) {
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop();
    for (const ent of fs.readdirSync(cur, { withFileTypes: true })) {
      if (ent.name === 'node_modules' || ent.name === 'dist') continue;
      const abs = path.join(cur, ent.name);
      if (ent.isDirectory()) stack.push(abs);
      else if (/\.(test|spec)\.[cm]?[jt]sx?$/.test(ent.name)) return true;
    }
  }
  return false;
}

function classifyPackage(pkg, dir) {
  const scripts = pkg.scripts || {};
  const testScript = String(scripts.test || '');
  const surface = pkg.jumentix?.testSurface
    || (hasTestFiles(dir) ? 'unit' : 'typecheck-only');

  if (!testScript.trim()) {
    return { kind: 'invalid', reason: 'missing test script' };
  }
  if (PLACEHOLDER_RE.test(testScript)) {
    return { kind: 'invalid', reason: 'placeholder test script (false green)' };
  }
  if (surface === 'unit' || hasTestFiles(dir)) {
    return { kind: 'unit', script: 'test' };
  }
  return { kind: 'typecheck-only', script: scripts.typecheck ? 'typecheck' : 'test' };
}

function runWorkspaceTests(options = {}) {
  const root = options.root || process.cwd();
  const logger = options.logger || console;
  const spawn = options.spawn || spawnSync;
  const results = [];
  const failures = [];

  for (const dir of packageDirs(root)) {
    const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
    const classification = classifyPackage(pkg, dir);
    if (classification.kind === 'invalid') {
      failures.push({ name: pkg.name, reason: classification.reason });
      results.push({
        name: pkg.name,
        kind: 'invalid',
        status: 1,
        reason: classification.reason
      });
      continue;
    }

    const result = spawn('bun', ['run', classification.script], {
      cwd: dir,
      stdio: 'inherit',
      env: { ...process.env }
    });
    const status = Number.isInteger(result.status) ? result.status : 1;
    results.push({ name: pkg.name, kind: classification.kind, status });
    if (status !== 0) failures.push({ name: pkg.name, status, kind: classification.kind });
  }

  const evidence = {
    schemaVersion: 1,
    gate: 'workspace-tests',
    results,
    summary: {
      unit: results.filter((r) => r.kind === 'unit').length,
      typecheckOnly: results.filter((r) => r.kind === 'typecheck-only').length,
      invalid: results.filter((r) => r.kind === 'invalid').length,
      failed: failures.length
    },
    outcome: failures.length === 0 ? 'passed' : 'failed',
    generatedAt: new Date().toISOString(),
    note: 'typecheck-only packages are verified by typecheck, not counted as unit-test coverage (JUM-557)'
  };

  const outDir = path.join(root, 'artifacts', 'ci');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'workspace-tests.json'), `${JSON.stringify(evidence, null, 2)}\n`);
  logger.log(`[ci] workspace-tests ${evidence.outcome}: unit=${evidence.summary.unit} typecheckOnly=${evidence.summary.typecheckOnly}`);

  return evidence;
}

if (isEntryPoint(module)) {
  const evidence = runWorkspaceTests();
  if (evidence.outcome !== 'passed') process.exitCode = 1;
}

module.exports = {
  classifyPackage,
  hasTestFiles,
  packageDirs,
  runWorkspaceTests
};
