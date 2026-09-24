#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Decide whether the coverage job must produce frontend Bun coverage for the
 * patch report. Version-only release PRs (and any PR that does not change a
 * frontend coverage subject) should skip `frontend:test:coverage` so a flake
 * in that suite cannot block an otherwise green release (JUM-889).
 *
 * Exit 0  → need frontend coverage (run mono:build + frontend:test:coverage)
 * Exit 1  → skip frontend coverage
 */
const cp = require('child_process');
const path = require('path');
const { isEntryPoint } = require('./lib/entry-point.js');
const {
  isCoverageSubject,
  loadCoverageIgnorePatterns
} = require('./lib/coverage-subject.js');

const ROOT = process.cwd();
const FRONTEND_PREFIX = 'apps/frontend/';

function run(cmd, options = {}) {
  return cp.execSync(cmd, {
    cwd: options.cwd || ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 1024 * 1024 * 32
  }).trim();
}

function resolveBaseRef(rootDir = ROOT) {
  const configuredBaseRef = String(process.env.JUMENTIX_PATCH_BASE_REF || '').trim();
  const candidates = [
    configuredBaseRef,
    'origin/main',
    'main'
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      run(`git rev-parse --verify ${candidate}`, { cwd: rootDir });
      return candidate;
    } catch {
      // keep trying
    }
  }
  throw new Error('Could not resolve base ref (origin/main or main).');
}

function listChangedFiles(baseRef, rootDir = ROOT) {
  const output = run(`git diff --name-only --no-color ${baseRef}...HEAD`, { cwd: rootDir });
  return output
    .split('\n')
    .map((line) => line.trim().replace(/\\/g, '/'))
    .filter(Boolean);
}

/**
 * @param {{ rootDir?: string, baseRef?: string, listFiles?: Function, subject?: Function }} [options]
 * @returns {{ needed: boolean, baseRef: string, subjects: string[], changed: string[] }}
 */
function evaluateNeedsFrontendPatchCoverage(options = {}) {
  const rootDir = options.rootDir || ROOT;
  const baseRef = options.baseRef || resolveBaseRef(rootDir);
  const changed = options.listFiles
    ? options.listFiles(baseRef, rootDir)
    : listChangedFiles(baseRef, rootDir);
  const patterns = loadCoverageIgnorePatterns(rootDir);
  const subject = options.subject || ((file) => isCoverageSubject(file, {
    rootDir,
    coverageIgnorePatterns: patterns
  }));
  const subjects = changed.filter((file) => (
    file === FRONTEND_PREFIX.slice(0, -1)
    || file.startsWith(FRONTEND_PREFIX)
  ) && subject(file));
  return {
    needed: subjects.length > 0,
    baseRef,
    subjects,
    changed
  };
}

function main() {
  const verdict = evaluateNeedsFrontendPatchCoverage();
  const outPath = process.env.JUMENTIX_FRONTEND_COVERAGE_VERDICT;
  if (outPath) {
    const fs = require('fs');
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, `${JSON.stringify(verdict, null, 2)}\n`);
  }
  if (verdict.needed) {
    console.log(
      `[needs-frontend-patch-coverage] NEED subjects=${verdict.subjects.length} `
      + `base=${verdict.baseRef}`
    );
    process.exit(0);
  }
  console.log(
    `[needs-frontend-patch-coverage] SKIP no frontend coverage subjects `
    + `base=${verdict.baseRef} changed=${verdict.changed.length}`
  );
  process.exit(1);
}

if (isEntryPoint(module)) {
  try {
    main();
  } catch (error) {
    console.error('[needs-frontend-patch-coverage] ERROR:', error.message);
    // Fail closed: when we cannot decide, produce frontend coverage.
    process.exit(0);
  }
}

module.exports = {
  FRONTEND_PREFIX,
  evaluateNeedsFrontendPatchCoverage,
  listChangedFiles,
  resolveBaseRef
};
