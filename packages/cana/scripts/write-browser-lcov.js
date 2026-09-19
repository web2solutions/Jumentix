#!/usr/bin/env bun
/* eslint-disable no-console */
/**
 * Emit `coverage/browser/lcov.info` from the browser Istanbul JSON report.
 *
 * Requirement 112 §4 measures `packages/cana` in the browser. Sonar reads LCOV;
 * excluding cana from Sonar coverage would be a silent bypass of that
 * measurement. This writes an LCOV twin of `coverage/browser/coverage-final.json`
 * so `sonar.javascript.lcov.reportPaths` can include it.
 *
 * Implemented with `istanbul-lib-coverage` only — `istanbul-lib-report` /
 * `istanbul-reports` are transitive under Bun's install layout and are not
 * resolvable as bare package names here, so a hand-written LCOV emitter keeps
 * the gate free of a dependency that would only exist for this one file.
 */
const fs = require('node:fs');
const path = require('node:path');
const libCoverage = require('istanbul-lib-coverage');
const { isEntryPoint } = require('../../../ci-cd/lib/entry-point.js');

const ROOT = process.cwd();
const INPUT = path.join(ROOT, 'coverage', 'browser', 'coverage-final.json');
const OUTPUT = path.join(ROOT, 'coverage', 'browser', 'lcov.info');

/** Line hit map from a file's statement counters. */
function lineHitsFromFile(fileCoverage) {
  const hits = new Map();
  const { statementMap, s } = fileCoverage;
  for (const [id, count] of Object.entries(s)) {
    const statement = statementMap[id];
    if (!statement?.start?.line) continue;
    const line = statement.start.line;
    const previous = hits.get(line) || 0;
    hits.set(line, previous + count);
  }
  return hits;
}

/**
 * LCOV `SF:` path relative to the repository root.
 *
 * Jest's lcov.info uses repository-relative paths. Absolute CI paths
 * (`/home/runner/work/...`) do not match Sonar's source keys, so cana looked
 * uncovered on new code and the quality gate reported ~58% Coverage on New
 * Code despite a 98%+ browser report.
 */
function toSonarSourcePath(filePath, root = ROOT) {
  const absolute = path.resolve(filePath);
  const relative = path.relative(root, absolute);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return absolute.split(path.sep).join('/');
  }
  return relative.split(path.sep).join('/');
}

/** One LCOV record for a single instrumented file. */
function toLcovRecord(fileCoverage) {
  const { fnMap, f, branchMap, b } = fileCoverage;
  const functionIds = Object.keys(fnMap || {});
  const lines = [
    'TN:',
    `SF:${toSonarSourcePath(fileCoverage.path)}`
  ];

  for (const id of functionIds) {
    const fn = fnMap[id];
    const name = fn.name || `(anonymous_${id})`;
    const line = fn.decl?.start?.line || fn.loc?.start?.line || 0;
    lines.push(`FN:${line},${name}`);
  }
  for (const id of functionIds) {
    const name = fnMap[id].name || `(anonymous_${id})`;
    lines.push(`FNDA:${f[id] || 0},${name}`);
  }
  lines.push(
    `FNF:${functionIds.length}`,
    `FNH:${functionIds.filter((id) => (f[id] || 0) > 0).length}`
  );

  let branchFound = 0;
  let branchHit = 0;
  const branchLines = [];
  for (const [id, locations] of Object.entries(b || {})) {
    const meta = branchMap[id];
    const line = meta?.loc?.start?.line || 0;
    locations.forEach((count, index) => {
      branchFound += 1;
      if (count > 0) branchHit += 1;
      branchLines.push(`BRDA:${line},${id},${index},${count}`);
    });
  }
  lines.push(...branchLines, `BRF:${branchFound}`, `BRH:${branchHit}`);

  const lineHits = lineHitsFromFile(fileCoverage);
  const sortedLines = [...lineHits.keys()].sort((left, right) => left - right);
  lines.push(
    ...sortedLines.map((line) => `DA:${line},${lineHits.get(line)}`),
    `LF:${sortedLines.length}`,
    `LH:${sortedLines.filter((line) => (lineHits.get(line) || 0) > 0).length}`,
    'end_of_record'
  );
  return lines.join('\n');
}

function run() {
  if (!fs.existsSync(INPUT)) {
    console.error(
      `[browser-lcov] missing ${INPUT}. Run \`bun run test:browser\` first.`
    );
    return 1;
  }

  const map = libCoverage.createCoverageMap(JSON.parse(fs.readFileSync(INPUT, 'utf8')));
  const records = map.files().map((file) => toLcovRecord(map.fileCoverageFor(file).data));
  const body = `${records.join('\n')}\n`;

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, body);

  if (!fs.existsSync(OUTPUT) || fs.statSync(OUTPUT).size === 0) {
    console.error('[browser-lcov] failed to write a non-empty lcov.info');
    return 1;
  }

  console.log(`[browser-lcov] wrote ${OUTPUT} (${map.files().length} file(s))`);
  return 0;
}

if (isEntryPoint(module)) {
  process.exit(run());
}

module.exports = { run, toLcovRecord, lineHitsFromFile, toSonarSourcePath };
