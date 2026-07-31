/* eslint-disable no-console */
const { spawnSync } = require('child_process');
const { computeAffectedWorkspaces, readChangedFiles } = require('./check-affected-workspaces');
const { isEntryPoint } = require('./lib/entry-point.js');

function runCommand(command, args, cwd = process.cwd()) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit' });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${String(result.status)}`);
  }
}

function resolveCiPlan(affected) {
  // Scope information remains useful evidence, but delivery boundaries must never
  // omit required cells. The canonical matrix already covers every workspace.
  void affected;
  return [['bun', ['run', 'ci:gate:strict']]];
}

function resolveInputFiles(argvFiles = [], options = {}) {
  const files = argvFiles.map((file) => String(file || '').trim()).filter(Boolean);
  if (files.length > 0) {
    return files;
  }

  const baseRef = String(options.baseRef || process.env.AAA_CI_BASE_REF || 'origin/main');
  const readChanged = typeof options.readChangedFiles === 'function'
    ? options.readChangedFiles
    : readChangedFiles;
  return readChanged(baseRef);
}

function run() {
  const files = resolveInputFiles(process.argv.slice(2));
  const affected = computeAffectedWorkspaces(files);
  const commands = resolveCiPlan(affected);

  console.log('[ci-monorepo] affected scope');
  console.log(JSON.stringify(affected, null, 2));

  for (const [command, args] of commands) {
    console.log(`\n[ci-monorepo] running: ${command} ${args.join(' ')}`);
    runCommand(command, args);
  }

  console.log('\n[ci-monorepo] completed successfully.');
}

if (isEntryPoint(module)) {
  run();
}

module.exports = {
  resolveCiPlan,
  resolveInputFiles
};
