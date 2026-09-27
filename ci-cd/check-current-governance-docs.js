#!/usr/bin/env bun
/* eslint-disable no-console */

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { gitBinary } = require('./lib/git-binary.js');
const { isEntryPoint } = require('./lib/entry-point.js');

const ROOT = path.resolve(__dirname, '..');
const EXCLUDED_FILES = new Set([
  'documentation/md/HISTORICAL-TRANSITIONS.md',
  'documentation/md/HISTORICAL-TRANSITIONS.pt-BR.md',
  'CHANGELOG.md',
  'CHANGELOG.pt-BR.md'
]);
const PNPM_POLICY_FILES = new Set([
  '.agents/requirements/software/126-service-management-ownership-and-public-contracts.md',
  'documentation/md/SERVICE-MANAGEMENT-OPERATIONS-CONSOLE.md',
  'documentation/md/SERVICE-MANAGEMENT-OPERATIONS-CONSOLE.pt-BR.md'
]);
const RETIRED_PATHS = [
  '.agents/project-todos.md',
  'JUMENTIX-MONOREPO-EXECUTION-PLAN',
  'JUMENTIX-MIGRATION-INVENTORY-AND-ROLLBACK',
  'JUMENTIX-WAVE5-',
  'BUN-MIGRATION-BASELINE'
];
const RETIRED_REPOSITORY_SLUG = 'XpertMinds/Jumentix';

function trackedMarkdownFiles(rootDir = ROOT) {
  return execFileSync(gitBinary(), ['ls-files', '*.md'], { cwd: rootDir, encoding: 'utf8' })
    .split('\n')
    .filter(Boolean)
    .filter((filePath) => fs.existsSync(path.join(rootDir, filePath)))
    .filter((filePath) => !EXCLUDED_FILES.has(filePath));
}

/**
 * Requirement 076: contributor documentation ships in English and Portuguese.
 * Six evidence records under documentation/md existed in English only until
 * JUM-895 found them; nothing checked the pair.
 */
function missingLanguageTwins(files) {
  const present = new Set(files);
  const failures = [];
  for (const file of files) {
    if (!file.startsWith('documentation/md/') || !file.endsWith('.md')) continue;
    const isPortuguese = file.endsWith('.pt-BR.md');
    const twin = isPortuguese ? file.replace(/\.pt-BR\.md$/, '.md') : file.replace(/\.md$/, '.pt-BR.md');
    if (!present.has(twin)) {
      failures.push(`${file}: missing ${isPortuguese ? 'English' : 'Portuguese'} counterpart ${twin} (Requirement 076)`);
    }
  }
  return failures;
}

function validateCurrentGovernanceDocs(rootDir = ROOT) {
  const failures = [...missingLanguageTwins(trackedMarkdownFiles(rootDir))];

  for (const relativePath of trackedMarkdownFiles(rootDir)) {
    const contents = fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
    const lines = contents.split('\n');

    lines.forEach((line, index) => {
      const location = `${relativePath}:${index + 1}`;
      if (/pnpm run/i.test(line) && !PNPM_POLICY_FILES.has(relativePath)) {
        failures.push(`${location}: active documentation must use bun run, not pnpm run`);
      }
      if (/CircleCI is disabled/i.test(line)) {
        failures.push(`${location}: CircleCI is the canonical CI orchestrator, not disabled`);
      }
      if (/GitHub Project/i.test(line) && /single source of truth|canonical planning|authoritative planning/i.test(line)) {
        failures.push(`${location}: Linear is the only planning source of truth`);
      }
      if (line.includes(RETIRED_REPOSITORY_SLUG)) {
        failures.push(`${location}: active documentation must use web2solutions/Jumentix, not ${RETIRED_REPOSITORY_SLUG}`);
      }
      for (const retiredPath of RETIRED_PATHS) {
        if (line.includes(retiredPath)) {
          failures.push(`${location}: references retired material ${retiredPath}`);
        }
      }
    });
  }

  return failures;
}

function main(rootDir = ROOT) {
  const failures = validateCurrentGovernanceDocs(rootDir);
  if (failures.length > 0) {
    failures.forEach((failure) => console.error(failure));
    process.exitCode = 1;
    return failures;
  }

  console.log('Current governance documentation check passed.');
  return [];
}

if (isEntryPoint(module)) main();

module.exports = { RETIRED_PATHS, missingLanguageTwins, RETIRED_REPOSITORY_SLUG, trackedMarkdownFiles, validateCurrentGovernanceDocs };
