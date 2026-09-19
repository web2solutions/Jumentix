#!/usr/bin/env bun
/* eslint-disable no-console */

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { gitBinary } = require('./lib/git-binary.js');

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

function trackedMarkdownFiles(rootDir = ROOT) {
  return execFileSync(gitBinary(), ['ls-files', '*.md'], { cwd: rootDir, encoding: 'utf8' })
    .split('\n')
    .filter(Boolean)
    .filter((filePath) => fs.existsSync(path.join(rootDir, filePath)))
    .filter((filePath) => !EXCLUDED_FILES.has(filePath));
}

function validateCurrentGovernanceDocs(rootDir = ROOT) {
  const failures = [];

  for (const relativePath of trackedMarkdownFiles(rootDir)) {
    const contents = fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
    const lines = contents.split('\n');

    lines.forEach((line, index) => {
      const location = `${relativePath}:${index + 1}`;
      if (/pnpm run/i.test(line) && !PNPM_POLICY_FILES.has(relativePath)) {
        failures.push(`${location}: active documentation must use bun run, not pnpm run`);
      }
      if (/CircleCI is disabled/i.test(line)) {
        failures.push(`${location}: CircleCI is the secondary public CI mirror, not disabled`);
      }
      if (/GitHub Project/i.test(line) && /single source of truth|canonical planning|authoritative planning/i.test(line)) {
        failures.push(`${location}: Linear is the only planning source of truth`);
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

if (require.main === module) main();

module.exports = { RETIRED_PATHS, trackedMarkdownFiles, validateCurrentGovernanceDocs };
