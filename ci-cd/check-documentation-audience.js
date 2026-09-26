#!/usr/bin/env bun
/* eslint-disable no-console */

/**
 * Documentation audience gate (Requirement 066, audience matrix amendment, JUM-892).
 *
 * Every public surface serves exactly one reader. The root README and the
 * commercial website pages serve a prospect; the website `/docs` tree serves a
 * developer. Neither may carry internal governance vocabulary — CI/gate control
 * variables, CI-provider fallback mechanics, requirement numbers, Linear issue
 * ids or `.agents/` paths. Those facts live in `.agents/**` and in the
 * contributor documentation under `documentation/md/**`, and public layers link
 * there instead of repeating them.
 *
 * The README leak that motivated this gate (`JUMENTIX_ENABLE_GITHUB_ACTIONS_CI`
 * restated verbatim for first-time visitors) passed every existing check.
 *
 * Runtime configuration keys such as `JUMENTIX_HTTP_FRAMEWORK` are public
 * product configuration (Requirements 043/126) and are deliberately not
 * matched: the variable rule names only the internal gate/CI controls.
 *
 * Code files are scanned with comments removed — source comments are written
 * for contributors and may cite issues; rendered strings may not.
 *
 * Known offenders are held in `ci-cd/documentation-audience-allowlist.json`,
 * one entry per file and rule with the owning issue. The register is
 * shrink-only: an entry whose file no longer exists, or no longer matches its
 * rule, fails the gate so a fixed file cannot keep its exemption.
 */

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { gitBinary } = require('./lib/git-binary.js');
const { isEntryPoint } = require('./lib/entry-point.js');

const ROOT = path.resolve(__dirname, '..');
const ALLOWLIST_PATH = path.join(__dirname, 'documentation-audience-allowlist.json');
const WEBSITE = 'apps/jumentix-website';

const RULES = Object.freeze([
  Object.freeze({
    id: 'internal-ci-variable',
    pattern: /\bJUMENTIX_(?:ENABLE_GITHUB_ACTIONS_CI|QUALITY_GATE_TARGET|GATE_V2(?:_SHADOW)?|TEST_RUNTIME)\b/,
    reason: 'internal CI/gate control variable'
  }),
  Object.freeze({
    id: 'ci-provider-mechanics',
    pattern: /canonical CI (?:orchestrator|provider)|GitHub Actions (?:is )?retained|orquestrador can[oô]nico de CI|GitHub Actions (?:est[aá] )?retido/i,
    reason: 'internal CI-provider canonical/fallback mechanics'
  }),
  Object.freeze({
    id: 'requirement-number',
    pattern: /\b(?:Requirements?|Requisitos?|Req\.?)\s+`?\d{3}\b/,
    reason: 'requirement number restated in a public layer'
  }),
  Object.freeze({
    id: 'linear-issue-id',
    pattern: /\bJUM-\d+\b/,
    reason: 'Linear issue id in a public layer'
  }),
  Object.freeze({
    id: 'agents-path',
    pattern: /(?:^|[\s(`'"/[])\.agents\//,
    reason: 'link or path into internal .agents/ governance'
  })
]);

/** Audience matrix: which tracked files belong to which public layer. */
const LAYERS = Object.freeze([
  Object.freeze({
    id: 'prospect',
    matches: (file) => file === 'README.md'
      || file === 'README.pt-BR.md'
      || (isWebsiteSource(file, 'components') || isWebsiteSource(file, 'app'))
  }),
  Object.freeze({
    id: 'developer-site',
    matches: (file) => file.startsWith(`${WEBSITE}/content/`) && /\.mdx?$/.test(file)
  })
]);

function isWebsiteSource(file, dir) {
  if (!file.startsWith(`${WEBSITE}/${dir}/`)) return false;
  if (!/\.(?:tsx?|mdx?)$/.test(file)) return false;
  return !/(?:\.test\.|\.spec\.|\.stories\.|\/__tests__\/)/.test(file);
}

function layerFor(file) {
  const layer = LAYERS.find((candidate) => candidate.matches(file));
  return layer ? layer.id : null;
}

/**
 * Remove `//` and `/* *\/` comments from TS/TSX, keeping line numbers stable.
 * A `//` preceded by `:` is a URL scheme, not a comment.
 */
function stripCodeComments(source) {
  const withoutBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ' '));
  return withoutBlocks.replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function scannableText(file, contents) {
  return /\.tsx?$/.test(file) ? stripCodeComments(contents) : contents;
}

function findViolations(file, contents) {
  const layer = layerFor(file);
  if (!layer) return [];
  const lines = scannableText(file, contents).split('\n');
  const violations = [];
  lines.forEach((line, index) => {
    for (const rule of RULES) {
      if (rule.pattern.test(line)) {
        violations.push({ file, line: index + 1, layer, rule: rule.id, reason: rule.reason });
      }
    }
  });
  return violations;
}

function trackedPublicFiles(rootDir = ROOT) {
  return execFileSync(gitBinary(), ['ls-files', 'README.md', 'README.pt-BR.md', `${WEBSITE}/components`, `${WEBSITE}/app`, `${WEBSITE}/content`], {
    cwd: rootDir,
    encoding: 'utf8'
  })
    .split('\n')
    .filter(Boolean)
    .filter((file) => layerFor(file) !== null)
    .filter((file) => fs.existsSync(path.join(rootDir, file)));
}

function loadAllowlist(allowlistPath = ALLOWLIST_PATH) {
  if (!fs.existsSync(allowlistPath)) {
    throw new Error(`Documentation audience allow-list is missing: ${allowlistPath}`);
  }
  const entries = JSON.parse(fs.readFileSync(allowlistPath, 'utf8'));
  if (!Array.isArray(entries)) throw new Error('Documentation audience allow-list must be a JSON array.');
  const ruleIds = new Set(RULES.map((rule) => rule.id));
  entries.forEach((entry, index) => {
    for (const field of ['file', 'rule', 'issue', 'reason']) {
      if (typeof entry[field] !== 'string' || entry[field].trim() === '') {
        throw new Error(`Allow-list entry ${index} is missing "${field}".`);
      }
    }
    if (!ruleIds.has(entry.rule)) throw new Error(`Allow-list entry ${index} names unknown rule "${entry.rule}".`);
    if (!/^JUM-\d+$/.test(entry.issue)) throw new Error(`Allow-list entry ${index} issue must be a JUM-NNN id.`);
  });
  return entries;
}

function validateDocumentationAudience({ rootDir = ROOT, allowlistPath = ALLOWLIST_PATH, files } = {}) {
  const allowlist = loadAllowlist(allowlistPath);
  const allowed = new Set(allowlist.map((entry) => `${entry.file}::${entry.rule}`));
  const scanned = files || trackedPublicFiles(rootDir);
  const failures = [];
  const hitKeys = new Set();

  for (const file of scanned) {
    const contents = fs.readFileSync(path.join(rootDir, file), 'utf8');
    for (const violation of findViolations(file, contents)) {
      const key = `${violation.file}::${violation.rule}`;
      hitKeys.add(key);
      if (!allowed.has(key)) {
        failures.push(`${violation.file}:${violation.line}: [${violation.layer}] ${violation.reason} (${violation.rule})`);
      }
    }
  }

  for (const entry of allowlist) {
    const key = `${entry.file}::${entry.rule}`;
    if (!fs.existsSync(path.join(rootDir, entry.file))) {
      failures.push(`${entry.file}: allow-list entry for ${entry.rule} names a file that no longer exists — remove it`);
    } else if (!hitKeys.has(key)) {
      failures.push(`${entry.file}: allow-list entry for ${entry.rule} (${entry.issue}) no longer matches — remove it`);
    }
  }

  return failures;
}

function main(rootDir = ROOT) {
  const failures = validateDocumentationAudience({ rootDir });
  if (failures.length > 0) {
    failures.forEach((failure) => console.error(failure));
    console.error(`\n${failures.length} documentation audience violation(s). Public layers link to internal governance; they do not restate it (Requirement 066).`);
    process.exitCode = 1;
    return failures;
  }
  console.log('Documentation audience check passed.');
  return [];
}

if (isEntryPoint(module)) main();

module.exports = {
  LAYERS,
  RULES,
  findViolations,
  layerFor,
  loadAllowlist,
  stripCodeComments,
  trackedPublicFiles,
  validateDocumentationAudience
};
