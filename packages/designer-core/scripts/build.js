#!/usr/bin/env bun
/* eslint-disable no-console */
/**
 * Build `@jumentix/designer-core` (JUM-493).
 *
 * The package's `src/` is the canonical home of the DOM-free designer core —
 * plain browser-safe ESM with JSDoc. The build is deliberately small:
 *
 * 1. copies `src/` into `dist/` verbatim, preserving the layout so the
 *    modules' relative imports resolve unchanged;
 * 2. generates type declarations from the JSDoc-annotated sources with the
 *    repo-pinned TypeScript compiler, emitted next to each module.
 *
 * The closure is walked, not enumerated, because the package src/ IS the
 * boundary now: anything placed in `src/` is package surface by definition.
 * What keeps a DOM-tainted module from shipping silently is the proof, not
 * the list — `test/dom-free.test.ts` AST-scans every file that lands in
 * `dist/`, and `test/packaging.test.ts` asserts the artifact contains exactly
 * the `src/` tree and nothing else.
 */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const packageRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(packageRoot, '..', '..');
const srcRoot = path.join(packageRoot, 'src');
const distRoot = path.join(packageRoot, 'dist');

/** Every JavaScript module under `dir`, relative to it, sorted. */
function listModules(dir, prefix = '') {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) return listModules(path.join(dir, rel), rel);
    return entry.name.endsWith('.js') ? [rel] : [];
  }).sort();
}

function main() {
  const modules = listModules(srcRoot);
  if (modules.length === 0) {
    console.error('[designer-core] src/ holds no modules; nothing to build.');
    process.exit(1);
  }

  fs.rmSync(distRoot, { recursive: true, force: true });
  for (const rel of modules) {
    const to = path.join(distRoot, rel);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(path.join(srcRoot, rel), to);
  }

  // Type declarations from the copied JSDoc-annotated sources, emitted next
  // to each module. `process.execPath` rather than a bare `tsc`: the pinned
  // toolchain that is running this script is the one that must compile.
  const tscCli = path.join(repoRoot, 'node_modules', 'typescript', 'bin', 'tsc');
  execFileSync(process.execPath, [tscCli, '-p', 'tsconfig.build.json'], {
    cwd: packageRoot,
    stdio: 'inherit'
  });

  console.log(`[designer-core] built dist/ — ${modules.length} modules + declarations.`);
}

main();
