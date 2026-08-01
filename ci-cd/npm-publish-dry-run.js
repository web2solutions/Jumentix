#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = process.cwd();
const packagesDir = path.join(root, 'packages');

if (!fs.existsSync(packagesDir)) {
  console.log('[npm-dry-run] No packages directory found.');
  process.exit(0);
}

const packageDirs = fs
  .readdirSync(packagesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => path.join(packagesDir, entry.name));

for (const dir of packageDirs) {
  const packageJsonPath = path.join(dir, 'package.json');
  if (!fs.existsSync(packageJsonPath)) continue;

  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  if (pkg.private) {
    console.log(`[npm-dry-run] skip private package: ${pkg.name}`);
    continue;
  }

  const name = String(pkg.name || '');
  if (!name.startsWith('@xpertminds/')) {
    console.log(
      `[npm-dry-run][warning] package is not in @xpertminds scope yet: ${name} (prepare rename before publish)`
    );
  }

  try {
    // `process.execPath` rather than the string 'bun'. A bare command name is
    // resolved through PATH, so this could shell out to a different Bun than the
    // pinned one that is running — which defeats Requirement 096 quietly, since
    // the dry run would still report success. It also drops the shell entirely.
    execFileSync(
      process.execPath,
      ['publish', '--dry-run', '--access', 'public'],
      { cwd: dir, stdio: 'inherit' }
    );
  } catch (error) {
    console.error(`[npm-dry-run][error] dry-run failed for ${name}`);
    process.exit(1);
  }
}

console.log('[npm-dry-run] completed.');
