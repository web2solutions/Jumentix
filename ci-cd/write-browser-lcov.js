#!/usr/bin/env bun
/* eslint-disable no-console */
/**
 * Emit `coverage/browser/lcov.info` from the browser Istanbul JSON report.
 *
 * Requirement 112 §4 measures `packages/cana` in the browser. Sonar reads LCOV;
 * excluding cana from Sonar coverage would be a silent bypass of that
 * measurement. This writes an LCOV twin of `coverage/browser/coverage-final.json`
 * so `sonar.javascript.lcov.reportPaths` can include it.
 */
const fs = require('fs');
const path = require('path');
const libCoverage = require('istanbul-lib-coverage');
const libReport = require('istanbul-lib-report');
const reports = require('istanbul-reports');
const { isEntryPoint } = require('./lib/entry-point.js');

const ROOT = process.cwd();
const INPUT = path.join(ROOT, 'coverage', 'browser', 'coverage-final.json');
const OUTPUT_DIR = path.join(ROOT, 'coverage', 'browser');

function run() {
  if (!fs.existsSync(INPUT)) {
    console.error(
      `[browser-lcov] missing ${INPUT}. Run \`bun run test:browser\` first.`
    );
    return 1;
  }

  const map = libCoverage.createCoverageMap(JSON.parse(fs.readFileSync(INPUT, 'utf8')));
  const context = libReport.createContext({
    dir: OUTPUT_DIR,
    coverageMap: map
  });
  reports.create('lcovonly', { file: 'lcov.info' }).execute(context);

  const out = path.join(OUTPUT_DIR, 'lcov.info');
  if (!fs.existsSync(out) || fs.statSync(out).size === 0) {
    console.error('[browser-lcov] failed to write a non-empty lcov.info');
    return 1;
  }

  console.log(`[browser-lcov] wrote ${out}`);
  return 0;
}

if (isEntryPoint(module)) {
  process.exit(run());
}

module.exports = { run };
