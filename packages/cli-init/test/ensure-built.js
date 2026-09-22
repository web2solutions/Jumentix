/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require('fs');
const os = require('os');
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

/**
 * Resolve Bun even when this helper is loaded from Jest, whose own process is
 * Node. The official installer leaves its absolute executable at
 * `~/.bun/bin/bun`; `BUN_INSTALL` is optional in GitHub Actions. Keeping the
 * lookup explicit avoids both a PATH-dependent spawn and the accidental
 * `node run build` invocation that prevents coverage collection.
 */
function resolveBunBinary({
  versions = process.versions,
  execPath = process.execPath,
  bunInstall = process.env.BUN_INSTALL,
  platform = process.platform,
  homeDirectory = os.homedir,
  exists = pathExists
} = {}) {
  if (versions.bun) return execPath;

  const installRoot = bunInstall || path.join(homeDirectory(), '.bun');
  const executable = path.join(installRoot, 'bin', platform === 'win32' ? 'bun.exe' : 'bun');
  if (!exists(executable)) {
    throw new Error(`ensure-built: Bun executable is unavailable at ${executable}`);
  }
  return executable;
}

function ensureDesignerCoreBuilt() {
  const distEntry = path.join(designerCoreRoot, 'dist', 'index.js');
  if (pathExists(distEntry)) return;
  if (!pathExists(path.join(designerCoreRoot, 'package.json'))) {
    throw new Error(
      'ensure-built: packages/designer-core is missing (required by @jumentix/cli-init)'
    );
  }
  execFileSync(resolveBunBinary(), ['run', 'build'], {
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
    execFileSync(resolveBunBinary(), ['run', 'build'], {
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
  ensureDesignerCoreLinked,
  resolveBunBinary
};
