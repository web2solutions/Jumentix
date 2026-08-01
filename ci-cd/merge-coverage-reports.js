#!/usr/bin/env bun
/* eslint-disable no-console */
/**
 * Merge Bun + Node LCOV without double-counting files (JUM-437).
 */
const fs = require('fs');
const path = require('path');
const { isEntryPoint } = require('./lib/entry-point.js');

function splitRecords(lcovText) {
  const records = [];
  let current = [];
  for (const line of String(lcovText || '').split('\n')) {
    current.push(line);
    if (line.trim() === 'end_of_record') {
      records.push(current.join('\n'));
      current = [];
    }
  }
  return records;
}

function recordFile(record) {
  const match = record.match(/^SF:(.+)$/m);
  return match ? match[1].replace(/\\/g, '/') : null;
}

function hasBranchData(record) {
  return /^BRDA:/m.test(record) || /^BRF:/m.test(record);
}

function mergeLcovFiles(inputPaths, outputPath) {
  const seen = new Set();
  const merged = [];
  const stats = { inputs: inputPaths.length, records: 0, skippedDuplicates: 0, withBranches: 0 };

  for (const input of inputPaths) {
    if (!fs.existsSync(input)) continue;
    const text = fs.readFileSync(input, 'utf8');
    for (const record of splitRecords(text)) {
      const file = recordFile(record);
      if (!file) continue;
      if (seen.has(file)) {
        stats.skippedDuplicates += 1;
        continue;
      }
      seen.add(file);
      merged.push(record.endsWith('\n') ? record.trimEnd() : record);
      stats.records += 1;
      if (hasBranchData(record)) stats.withBranches += 1;
    }
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${merged.join('\n')}\n`);
  return stats;
}

function main() {
  const root = process.cwd();
  const inputs = [
    path.join(root, 'coverage', 'bun', 'lcov.info'),
    path.join(root, 'coverage', 'jest', 'lcov.info'),
    path.join(root, 'coverage', 'lcov.info')
  ];
  const output = process.env.JUMENTIX_MERGED_LCOV
    || path.join(root, 'coverage', 'merged', 'lcov.info');
  const stats = mergeLcovFiles(inputs, output);
  console.log(`[coverage-merge] wrote ${output} records=${stats.records} dupesSkipped=${stats.skippedDuplicates} withBranches=${stats.withBranches}`);
  const verdictPath = path.join(root, 'artifacts', 'ci', 'coverage-merge.json');
  fs.mkdirSync(path.dirname(verdictPath), { recursive: true });
  fs.writeFileSync(verdictPath, `${JSON.stringify({ ...stats, output }, null, 2)}\n`);
}

if (isEntryPoint(module)) {
  try {
    main();
  } catch (error) {
    console.error('[coverage-merge]', error.message);
    process.exit(1);
  }
}

module.exports = { hasBranchData, mergeLcovFiles, splitRecords };
