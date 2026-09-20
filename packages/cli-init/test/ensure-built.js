/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

/**
 * Jest / bun:test both load these suites. `dist/` is gitignored, so CI must
 * compile before requiring. Local `bun run test` already runs `pretest` build;
 * the monorepo gate invokes the suites directly and needs this guard.
 *
 * Side-effect on require: callers only need `require('./ensure-built')` before
 * any `../dist/...` import so eslint jest/require-hook stays quiet.
 */
function ensureCliInitBuilt() {
  const distEntry = path.join(__dirname, '..', 'dist', 'index.js');
  if (fs.existsSync(distEntry)) return;
  execFileSync('bun', ['run', 'build'], {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit'
  });
}

ensureCliInitBuilt();

module.exports = { ensureCliInitBuilt };
