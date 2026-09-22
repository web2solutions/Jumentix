/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

/**
 * Jest / bun:test both load these suites. `dist/` is gitignored, so CI must
 * compile before requiring. Local `bun run test` already runs `pretest` build;
 * the monorepo gate invokes the suites directly and needs this guard.
 *
 * Also ensures `@jumentix/designer-core` is built and linked under
 * `packages/cli-init/node_modules`. Spawned `bun bin/jumentix.js` resolves from
 * `dist/` and fails with ResolveMessage when the nested workspace link is
 * missing (common in cold CI installs that only hoist root packages).
 *
 * Side-effect on require: callers only need `require('./ensure-built')` before
 * any `../dist/...` import so eslint jest/require-hook stays quiet.
 */

const packageRoot = path.join(__dirname, '..');
const designerCoreRoot = path.join(packageRoot, '..', 'designer-core');

function pathExists(targetPath) {
  try {
    fs.accessSync(targetPath);
    return true;
  } catch {
    return false;
  }
}

function ensureDesignerCoreBuilt() {
  const distEntry = path.join(designerCoreRoot, 'dist', 'index.js');
  if (pathExists(distEntry)) return;
  if (!pathExists(path.join(designerCoreRoot, 'package.json'))) {
    throw new Error(
      'ensure-built: packages/designer-core is missing (required by @jumentix/cli-init)'
    );
  }
  // `process.execPath` rather than the string `bun`: a bare command is
  // resolved through PATH (Sonar javascript:S4036 / Security Rating). Using
  // the same Bun binary that is already running also keeps Requirement 096
  // pinned.
  execFileSync(process.execPath, ['run', 'build'], {
    cwd: designerCoreRoot,
    stdio: 'inherit'
  });
}

function ensureDesignerCoreLinked() {
  const linkDir = path.join(packageRoot, 'node_modules', '@jumentix');
  const linkPath = path.join(linkDir, 'designer-core');

  let needsLink = true;
  try {
    const stats = fs.lstatSync(linkPath);
    if (stats.isSymbolicLink() || stats.isDirectory()) {
      const resolved = fs.realpathSync(linkPath);
      if (resolved === fs.realpathSync(designerCoreRoot)) {
        needsLink = false;
      } else {
        fs.rmSync(linkPath, { recursive: true, force: true });
      }
    }
  } catch {
    needsLink = true;
  }

  if (!needsLink) return;

  fs.mkdirSync(linkDir, { recursive: true });
  fs.symlinkSync(path.relative(linkDir, designerCoreRoot), linkPath);
}

function ensureCliInitBuilt() {
  const distEntry = path.join(packageRoot, 'dist', 'index.js');
  if (!pathExists(distEntry)) {
    // `process.execPath` rather than the string `bun`: a bare command is
    // resolved through PATH (Sonar javascript:S4036 / Security Rating).
    execFileSync(process.execPath, ['run', 'build'], {
      cwd: packageRoot,
      stdio: 'inherit'
    });
  }
  ensureDesignerCoreBuilt();
  ensureDesignerCoreLinked();
}

ensureCliInitBuilt();

module.exports = {
  ensureCliInitBuilt,
  ensureDesignerCoreBuilt,
  ensureDesignerCoreLinked
};
