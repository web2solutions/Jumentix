/* eslint-disable no-console */
/**
 * Create the application release tag on main after a promotion (JUM-884).
 *
 * Order: compute next version → write locked versions → commit → annotated tag
 * → regenerate CHANGELOG → optional sync commit → push. Tag points at the
 * version-bump commit so package consumers and GitHub Releases share one SHA.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { gitBinary } = require('./lib/git-binary.js');
const { isEntryPoint } = require('./lib/entry-point.js');
const {
  APP_TAG_RE,
  resolveNextVersionFromRepo
} = require('./lib/next-version.js');

function runGit(args, options = {}) {
  try {
    return execFileSync(gitBinary(), args, {
      encoding: 'utf8',
      stdio: options.inherit ? 'inherit' : ['ignore', 'pipe', options.allowFailure ? 'ignore' : 'pipe'],
      cwd: options.cwd
    }).toString().trim();
  } catch (error) {
    if (options.allowFailure) return '';
    throw error;
  }
}

function getRepoRoot() {
  return runGit(['rev-parse', '--show-toplevel']);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function listAppPackageJsons(rootDir) {
  const appsDir = path.join(rootDir, 'apps');
  if (!fs.existsSync(appsDir)) return [];
  return fs.readdirSync(appsDir)
    .map((name) => path.join(appsDir, name, 'package.json'))
    .filter((filePath) => fs.existsSync(filePath));
}

function headHasAppTag(rootDir) {
  const head = runGit(['rev-parse', 'HEAD'], { cwd: rootDir });
  // Peel annotated tags to the commit SHA (*objectname); fall back to lightweight.
  const output = runGit([
    'for-each-ref',
    '--format=%(refname:short)%09%(if)%(*objectname)%(then)%(*objectname)%(else)%(objectname)%(end)',
    'refs/tags'
  ], { allowFailure: true, cwd: rootDir });
  if (!output) return null;
  for (const line of output.split('\n')) {
    const [name, sha] = line.split('\t');
    if (APP_TAG_RE.test(name) && sha === head) return name;
  }
  return null;
}

function applyLockedVersion(rootDir, version) {
  const rootPkgPath = path.join(rootDir, 'package.json');
  const rootPkg = readJson(rootPkgPath);
  rootPkg.version = version;
  writeJson(rootPkgPath, rootPkg);

  const policyPath = path.join(rootDir, 'release-policy.json');
  const policy = readJson(policyPath);
  policy.appLockedVersion = version;
  writeJson(policyPath, policy);

  const updatedApps = [];
  for (const appPkgPath of listAppPackageJsons(rootDir)) {
    const pkg = readJson(appPkgPath);
    pkg.version = version;
    writeJson(appPkgPath, pkg);
    updatedApps.push(path.relative(rootDir, appPkgPath));
  }

  return {
    rootPackage: 'package.json',
    policy: 'release-policy.json',
    apps: updatedApps
  };
}

function configureGitIdentity(rootDir) {
  const name = runGit(['config', 'user.name'], { allowFailure: true, cwd: rootDir });
  const email = runGit(['config', 'user.email'], { allowFailure: true, cwd: rootDir });
  if (!name) {
    runGit(['config', 'user.name', 'jumentix-release-bot'], { cwd: rootDir });
  }
  if (!email) {
    runGit(['config', 'user.email', 'release-bot@users.noreply.github.com'], { cwd: rootDir });
  }
}

function createAppReleaseTag(options = {}) {
  const dryRun = Boolean(options.dryRun);
  const push = options.push !== false;
  const rootDir = options.rootDir || getRepoRoot();

  const existing = headHasAppTag(rootDir);
  if (existing) {
    return {
      action: 'noop',
      reason: 'head-already-tagged',
      tag: existing,
      dryRun
    };
  }

  const next = resolveNextVersionFromRepo({ rootDir });
  if (next.action === 'noop') {
    return {
      action: 'noop',
      reason: next.reason,
      dryRun,
      next
    };
  }

  const tag = `v${next.nextVersion}`;
  const plan = {
    action: 'create',
    tag,
    version: next.nextVersion,
    baseVersion: next.baseVersion,
    bumpLevel: next.bumpLevel,
    dryRun
  };

  if (dryRun) {
    return plan;
  }

  const files = applyLockedVersion(rootDir, next.nextVersion);
  configureGitIdentity(rootDir);
  runGit(['add', files.rootPackage, files.policy, ...files.apps], { cwd: rootDir });
  runGit(['commit', '-m', `chore(release): ${tag}`], { cwd: rootDir });
  runGit(['tag', '-a', tag, '-m', `Application release ${tag}`], { cwd: rootDir });

  // Tag exists → changelog gains a real per-tag section.
  const bunBin = process.execPath.includes('bun') ? process.execPath : 'bun';
  execFileSync(bunBin, [path.join(rootDir, 'ci-cd/update-changelog.js')], {
    cwd: rootDir,
    stdio: 'inherit'
  });

  const changelogStatus = runGit(['status', '--porcelain', '--', 'CHANGELOG.md'], {
    allowFailure: true,
    cwd: rootDir
  });
  if (changelogStatus) {
    runGit(['add', 'CHANGELOG.md'], { cwd: rootDir });
    runGit(['commit', '-m', 'chore: synchronize changelog'], { cwd: rootDir });
  }

  if (push) {
    const branch = runGit(['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: rootDir });
    runGit(['push', 'origin', `HEAD:${branch}`], { cwd: rootDir, inherit: true });
    runGit(['push', 'origin', tag], { cwd: rootDir, inherit: true });
  }

  return {
    ...plan,
    files,
    pushed: push
  };
}

function main(argv = process.argv.slice(2)) {
  const dryRun = argv.includes('--dry-run');
  const noPush = argv.includes('--no-push');
  const result = createAppReleaseTag({ dryRun, push: !noPush && !dryRun });
  console.log(JSON.stringify(result, null, 2));
  return result;
}

module.exports = {
  applyLockedVersion,
  createAppReleaseTag,
  headHasAppTag,
  main
};

if (isEntryPoint(module)) {
  main();
}
