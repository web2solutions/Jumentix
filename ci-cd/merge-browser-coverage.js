#!/usr/bin/env bun
/* eslint-disable no-console */
/**
 * Requirement 112 §4 / JUM-417 — merge every engine's browser LCOV into the
 * single report Sonar and the threshold gate read.
 *
 * With one engine there is nothing to merge and `coverage/browser/lcov.info`
 * stands alone. With a matrix, each leg writes its own
 * `coverage/browser-<engine>/lcov.info`, and this file is the point where the
 * matrix becomes one measurement again.
 *
 * Merging is a UNION of counters, not a sum. The same instrumented bundle runs
 * on every engine, so the counter identities are identical; a statement hit on
 * any engine is covered. Summing hit counts would just inflate DA values, and
 * keeping only one engine's report would throw away the behaviours another
 * engine alone exercises — WebKit's storage paths being the reason the matrix
 * exists (JUM-417).
 */
const fs = require('node:fs');
const path = require('node:path');
const { isEntryPoint } = require('./lib/entry-point.js');

const ROOT = process.cwd();

/** The engines that may contribute reports, in merge precedence order. */
const ENGINES = Object.freeze(['chrome', 'firefox', 'webkit']);

/**
 * Where one engine's LCOV lives, relative to a coverage root.
 * Chrome keeps the historical `browser/` path so single-engine local runs
 * and existing consumers (`write-browser-lcov.js`, Sonar paths) keep working.
 */
function engineLcovPath(coverageRoot, engine) {
  return path.join(coverageRoot, engine === 'chrome' ? 'browser' : `browser-${engine}`, 'lcov.info');
}

/** LCOV inputs for a local run: per-engine dirs under coverage/. */
function localInputs(root) {
  return ENGINES
    .map((engine) => ({ engine, lcov: engineLcovPath(path.join(root, 'coverage'), engine) }))
    .filter(({ lcov }) => fs.existsSync(lcov));
}

/**
 * LCOV inputs from a coverage directory holding per-engine subdirectories.
 * Each engine's report was copied to `browser-<engine>/` before the next
 * engine rebuilt the canonical `browser/`, so every engine's file is still on
 * disk under `<dir>/browser-<engine>/lcov.info`. Chrome additionally accepts
 * the canonical `<dir>/browser/lcov.info` for the single-engine local shape.
 */
function artifactInputs(dir) {
  const inputs = [];
  for (const engine of ENGINES) {
    const candidates = [
      path.join(dir, `browser-${engine}`, 'lcov.info'),
      ...(engine === 'chrome' ? [path.join(dir, 'browser', 'lcov.info')] : [])
    ];
    const found = candidates.find((candidate) => fs.existsSync(candidate));
    if (found) inputs.push({ engine, lcov: found });
  }
  return inputs;
}

function parseLcov(text) {
  const records = [];
  let current = null;
  for (const line of String(text || '').split('\n')) {
    if (line.startsWith('SF:')) {
      current = { sf: line.slice(3).trim(), da: [], brda: [], other: [] };
      records.push(current);
      continue;
    }
    if (!current) continue;
    if (line.trim() === 'end_of_record') {
      current = null;
      continue;
    }
    if (line.startsWith('DA:')) current.da.push(line.slice(3));
    else if (line.startsWith('BRDA:')) current.brda.push(line.slice(5));
    else if (line.trim() !== '') current.other.push(line);
  }
  return records;
}

/** Hit counts as a map; keeps the rest of the entry for re-serialization. */
function countMap(entries) {
  const map = new Map();
  for (const entry of entries) {
    const comma = entry.lastIndexOf(',');
    map.set(entry.slice(0, comma), Number(entry.slice(comma + 1)) || 0);
  }
  return map;
}

/**
 * Union-merge one metric's counters across engines. A location hit at least
 * once anywhere is covered. DA hits are summed so the report still shows real
 * execution volume; BRDA hit flags are OR'd per branch path.
 */
function mergeCounters(perEngine) {
  const merged = new Map();
  for (const map of perEngine) {
    for (const [key, count] of map) {
      merged.set(key, (merged.get(key) || 0) + count);
    }
  }
  return merged;
}

/** A BRDA entry counts as hit when its execution count is positive. */
function isHit(entry) {
  const count = entry.slice(entry.lastIndexOf(',') + 1);
  return count !== '-' && Number(count) > 0;
}

function serializeRecords(records) {
  const lines = [];
  for (const record of records) {
    lines.push('TN:', `SF:${record.sf}`);
    // FN/FNDA/FNF/FNH and any other non-counter lines pass through from the
    // first engine that produced the file: names and declarations are a
    // property of the instrumented bundle, identical across engines.
    lines.push(...record.other.filter((line) => !/^(LF|LH|BRF|BRH):/.test(line)));
    for (const entry of record.brda) lines.push(`BRDA:${entry}`);
    lines.push(`BRF:${record.brda.length}`, `BRH:${record.brda.filter(isHit).length}`);
    for (const entry of record.da) lines.push(`DA:${entry}`);
    lines.push(`LF:${record.da.length}`, `LH:${record.da.filter(isHit).length}`, 'end_of_record');
  }
  return `${lines.join('\n')}\n`;
}

function mergeEngineReports(root = ROOT, inputs) {
  const resolved = inputs || localInputs(root);

  if (resolved.length === 0) {
    return { ok: false, message: 'No browser LCOV found for any engine (coverage/browser*/lcov.info).' };
  }

  if (resolved.length === 1) {
    const only = resolved[0];
    return {
      ok: true,
      engines: [only.engine],
      files: parseLcov(fs.readFileSync(only.lcov, 'utf8')).length,
      output: only.lcov,
      merged: false
    };
  }

  const byFile = new Map();
  for (const { lcov } of resolved) {
    for (const record of parseLcov(fs.readFileSync(lcov, 'utf8'))) {
      if (!byFile.has(record.sf)) byFile.set(record.sf, []);
      byFile.get(record.sf).push(record);
    }
  }

  const mergedRecords = [];
  for (const [sf, versions] of byFile) {
    const base = versions[0];
    mergedRecords.push({
      sf,
      other: base.other,
      da: [...mergeCounters(versions.map((v) => countMap(v.da))).entries()]
        .sort((a, b) => Number(a[0]) - Number(b[0]))
        .map(([line, hits]) => `${line},${hits}`),
      brda: [...mergeCounters(versions.map((v) => countMap(v.brda))).entries()]
        .map(([key, hits]) => `${key},${hits}`)
    });
  }

  const output = path.join(root, 'coverage', 'browser', 'lcov.info');
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, serializeRecords(mergedRecords));

  return {
    ok: true,
    engines: resolved.map((i) => i.engine),
    files: mergedRecords.length,
    output,
    merged: true
  };
}

function main(io = console, argv = process.argv.slice(2)) {
  const fromDirIndex = argv.indexOf('--from-dir');
  const inputs = fromDirIndex >= 0 ? artifactInputs(argv[fromDirIndex + 1]) : undefined;
  if (fromDirIndex >= 0 && inputs.length === 0) {
    io.error(`[browser-coverage-merge] no engine LCOV under ${argv[fromDirIndex + 1]}`);
    return 1;
  }
  const result = mergeEngineReports(ROOT, inputs);
  if (!result.ok) {
    io.error(`[browser-coverage-merge] ${result.message}`);
    return 1;
  }
  io.log(
    `[browser-coverage-merge] engines=${result.engines.join('+')} files=${result.files}` +
    `${result.merged ? ` merged -> ${result.output}` : ' single engine; canonical report untouched'}`
  );
  return 0;
}

if (isEntryPoint(module)) {
  process.exit(main());
}

module.exports = {
  ENGINES,
  artifactInputs,
  engineLcovPath,
  isHit,
  localInputs,
  mergeCounters,
  mergeEngineReports,
  parseLcov,
  serializeRecords
};
