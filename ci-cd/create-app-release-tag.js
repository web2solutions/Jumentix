/* eslint-disable no-console */
/**
 * Create the application release tag after a promotion to main (JUM-884 / JUM-889).
 *
 * Two modes:
 * 1. Local/git mode (default): commit + annotated tag + push. Only safe on a
 *    branch that accepts direct pushes (tests, scratch).
 * 2. `--github-api`: signed createCommitOnBranch + squash PR into `main` +
 *    annotated tag via GitHub API + GitHub Release. Required for the public
 *    repository (branch protection + required signatures). Owned by the
 *    always-on GitHub Actions workflow `.github/workflows/app-release.yml`,
 *    using CHANGELOG_GH_TOKEN from the `secrets` Environment (same as
 *    sync-changelog / Req 113 always-on exception).
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { gitBinary } = require('./lib/git-binary.js');
const { ghBinary } = require('./lib/gh-binary.js');
const { isEntryPoint } = require('./lib/entry-point.js');
const {
  APP_TAG_RE,
  resolveNextVersionFromRepo
} = require('./lib/next-version.js');
const {
  createAnnotatedTagRef,
  createSignedCommitOnBranchWithGh,
  resolveRepository,
  resolveToken
} = require('./lib/github-signed-commit.js');
const { createGithubRelease } = require('./create-github-release.js');

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

function runGh(args, options = {}) {
  const token = resolveToken(options.env || process.env);
  if (!token) {
    throw new Error(
      'Missing GH_TOKEN, GITHUB_TOKEN, or CHANGELOG_GH_TOKEN (fail closed).'
    );
  }
  try {
    return execFileSync(ghBinary(), args, {
      encoding: 'utf8',
      cwd: options.cwd,
      env: {
        ...process.env,
        ...(options.env || {}),
        GH_TOKEN: token,
        GITHUB_TOKEN: token
      },
      stdio: options.inherit
        ? 'inherit'
        : ['ignore', 'pipe', options.allowFailure ? 'ignore' : 'pipe']
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

function resolveSleepBinary(exists = fs.existsSync) {
  for (const candidate of ['/bin/sleep', '/usr/bin/sleep']) {
    if (exists(candidate)) return candidate;
  }
  throw new Error(
    'Could not find sleep in a fixed system location (/bin/sleep, /usr/bin/sleep).'
  );
}

function sleepMs(ms) {
  const seconds = Math.max(1, Math.ceil(ms / 1000));
  // Absolute path on purpose (Sonar javascript:S4036) — never spawn bare `sleep`.
  execFileSync(resolveSleepBinary(), [String(seconds)], { stdio: 'ignore' });
}

function resolveBunBinary(options = {}) {
  const execPath = options.execPath || process.execPath;
  const exists = options.exists || fs.existsSync;
  if (String(execPath).includes('bun')) return execPath;
  for (const candidate of ['/usr/local/bin/bun', '/opt/homebrew/bin/bun', '/usr/bin/bun']) {
    if (exists(candidate)) return candidate;
  }
  throw new Error(
    'Could not find bun at process.execPath or a fixed system location. '
      + 'Run under bun, or install bun to /usr/local/bin/bun.'
  );
}

function waitForPullRequestMergeable(prUrl, options = {}) {
  const timeoutMs = options.timeoutMs ?? 60 * 60 * 1000;
  const pollMs = options.pollMs ?? 30_000;
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const state = runGh(
      ['pr', 'view', prUrl, '--json', 'mergeStateStatus', '--jq', '.mergeStateStatus'],
      { env: options.env, cwd: options.cwd }
    );
    if (state === 'CLEAN' || state === 'UNSTABLE' || state === 'HAS_HOOKS') {
      return state;
    }
    if (state === 'BLOCKED' || state === 'UNKNOWN') {
      sleepMs(pollMs);
      continue;
    }
    throw new Error(`Unexpected merge state '${state}' on ${prUrl}`);
  }
  throw new Error(`Required checks did not pass within timeout on ${prUrl}`);
}

function openAndMergeReleasePr({
  branch,
  title,
  body,
  env,
  cwd,
  priorHeadRegex = '^chore/release-v[0-9]',
  wait = waitForPullRequestMergeable
}) {
  // Close older matching PRs so a failed generation cannot block forever.
  const prior = runGh([
    'pr', 'list', '--base', 'main', '--state', 'open',
    '--json', 'number,headRefName',
    '--jq', `.[] | select(.headRefName | test("${priorHeadRegex}")) | .number`
  ], { env, cwd, allowFailure: true });
  for (const number of prior.split('\n').map((s) => s.trim()).filter(Boolean)) {
    runGh(['pr', 'close', number, '--delete-branch'], { env, cwd, allowFailure: true });
  }

  const prUrl = runGh([
    'pr', 'create',
    '--base', 'main',
    '--head', branch,
    '--title', title,
    '--body', body
  ], { env, cwd });

  wait(prUrl, { env, cwd });
  runGh(['pr', 'merge', prUrl, '--squash', '--delete-branch'], { env, cwd, inherit: true });
  return prUrl;
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
  execFileSync(resolveBunBinary(), [path.join(rootDir, 'ci-cd/update-changelog.js')], {
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

/**
 * Production path for protected `main`: signed commits via PR, then tag+release.
 */
function resolveRepositoryFromGit(rootDir) {
  const url = runGit(['remote', 'get-url', 'origin'], { cwd: rootDir, allowFailure: true });
  if (!url) return '';
  const match = url.match(/github\.com[/:]([^/]+\/[^/.]+)(?:\.git)?$/i);
  return match ? match[1] : '';
}

function createAppReleaseTagGithubApi(options = {}) {
  const dryRun = Boolean(options.dryRun);
  const rootDir = options.rootDir || getRepoRoot();
  const env = options.env || process.env;
  const repository = options.repository
    || resolveRepository(env)
    || resolveRepositoryFromGit(rootDir);
  if (!repository) {
    throw new Error('GITHUB_REPOSITORY (or CIRCLE_PROJECT_*) is required for --github-api');
  }
  if (!dryRun && !resolveToken(env)) {
    throw new Error(
      'Missing GH_TOKEN, GITHUB_TOKEN, or CHANGELOG_GH_TOKEN (fail closed).'
    );
  }

  // Plan against the current checkout first — never mutate the worktree for dry-run.
  const existing = headHasAppTag(rootDir);
  if (existing) {
    return {
      action: 'noop',
      reason: 'head-already-tagged',
      tag: existing,
      dryRun,
      mode: 'github-api'
    };
  }

  const next = resolveNextVersionFromRepo({ rootDir });
  if (next.action === 'noop') {
    return {
      action: 'noop',
      reason: next.reason,
      dryRun,
      next,
      mode: 'github-api'
    };
  }

  const tag = `v${next.nextVersion}`;
  const plan = {
    action: 'create',
    tag,
    version: next.nextVersion,
    baseVersion: next.baseVersion,
    bumpLevel: next.bumpLevel,
    dryRun,
    mode: 'github-api'
  };

  if (dryRun) {
    return plan;
  }

  runGit(['fetch', '--tags', '--prune', 'origin'], { cwd: rootDir, allowFailure: true });
  runGit(['fetch', 'origin', 'main'], { cwd: rootDir, allowFailure: true });
  runGit(['checkout', '-B', 'main', 'origin/main'], { cwd: rootDir });

  // Re-evaluate on origin/main after checkout (HEAD may have differed).
  const existingOnMain = headHasAppTag(rootDir);
  if (existingOnMain) {
    return {
      action: 'noop',
      reason: 'head-already-tagged',
      tag: existingOnMain,
      dryRun,
      mode: 'github-api'
    };
  }

  const nextOnMain = resolveNextVersionFromRepo({ rootDir });
  if (nextOnMain.action === 'noop') {
    return {
      action: 'noop',
      reason: nextOnMain.reason,
      dryRun,
      next: nextOnMain,
      mode: 'github-api'
    };
  }

  const tagOnMain = `v${nextOnMain.nextVersion}`;
  const mainSha = runGit(['rev-parse', 'HEAD'], { cwd: rootDir });
  const branch = `chore/release-${tagOnMain}`;
  const files = applyLockedVersion(rootDir, nextOnMain.nextVersion);
  const relativePaths = [files.rootPackage, files.policy, ...files.apps];
  const additions = relativePaths.map((rel) => ({
    path: rel,
    contents: fs.readFileSync(path.join(rootDir, rel), 'utf8')
  }));

  // Create the release branch at main tip (empty push of the ref).
  runGh(['api', '-X', 'POST', `repos/${repository}/git/refs`,
    '-f', `ref=refs/heads/${branch}`,
    '-f', `sha=${mainSha}`
  ], { env, cwd: rootDir });

  const bump = createSignedCommitOnBranchWithGh({
    repository,
    branch,
    expectedHeadOid: mainSha,
    headline: `chore(release): ${tagOnMain}`,
    additions,
    env
  });

  const prUrl = openAndMergeReleasePr({
    branch,
    title: `chore(release): ${tagOnMain}`,
    body: [
      `Automated application version bump and release for \`${tagOnMain}\`.`,
      '',
      'Opened by `.github/workflows/app-release.yml` (JUM-889).',
      'After merge the workflow creates the annotated tag and GitHub Release.'
    ].join('\n'),
    env,
    cwd: rootDir,
    priorHeadRegex: '^chore/release-v[0-9]',
    wait: options.waitForPullRequestMergeable || waitForPullRequestMergeable
  });

  // Squash merge created a new commit on main — tag that tip.
  runGit(['fetch', 'origin', 'main'], { cwd: rootDir });
  runGit(['checkout', '-B', 'main', 'origin/main'], { cwd: rootDir });
  const releaseSha = runGit(['rev-parse', 'HEAD'], { cwd: rootDir });

  createAnnotatedTagRef({
    repository,
    tag: tagOnMain,
    message: `Application release ${tagOnMain}`,
    commitSha: releaseSha,
    env
  });

  // Refresh tags locally, regenerate changelog, open sync PR if needed.
  runGit(['fetch', '--tags', '--prune', 'origin'], { cwd: rootDir, allowFailure: true });
  execFileSync(resolveBunBinary(), [path.join(rootDir, 'ci-cd/update-changelog.js')], {
    cwd: rootDir,
    stdio: 'inherit'
  });

  let changelogPr = null;
  const changelogStatus = runGit(['status', '--porcelain', '--', 'CHANGELOG.md'], {
    allowFailure: true,
    cwd: rootDir
  });
  if (changelogStatus) {
    const changelogBranch = `chore/changelog-sync-${releaseSha.slice(0, 8)}`;
    runGh(['api', '-X', 'POST', `repos/${repository}/git/refs`,
      '-f', `ref=refs/heads/${changelogBranch}`,
      '-f', `sha=${releaseSha}`
    ], { env, cwd: rootDir });
    createSignedCommitOnBranchWithGh({
      repository,
      branch: changelogBranch,
      expectedHeadOid: releaseSha,
      headline: 'chore: synchronize changelog',
      additions: [{
        path: 'CHANGELOG.md',
        contents: fs.readFileSync(path.join(rootDir, 'CHANGELOG.md'), 'utf8')
      }],
      env
    });
    changelogPr = openAndMergeReleasePr({
      branch: changelogBranch,
      title: 'chore: synchronize changelog',
      body: `Changelog sync after application tag \`${tagOnMain}\` (JUM-889).`,
      env,
      cwd: rootDir,
      priorHeadRegex: '^chore/changelog-sync-[0-9a-f]{8}$',
      wait: options.waitForPullRequestMergeable || waitForPullRequestMergeable
    });
    // Re-fetch so release notes match the merged changelog when possible.
    runGit(['fetch', 'origin', 'main'], { cwd: rootDir });
    runGit(['checkout', '-B', 'main', 'origin/main'], { cwd: rootDir });
  }

  const release = createGithubRelease({
    tagName: tagOnMain,
    rootDir,
    env
  });

  return {
    action: 'create',
    tag: tagOnMain,
    version: nextOnMain.nextVersion,
    baseVersion: nextOnMain.baseVersion,
    bumpLevel: nextOnMain.bumpLevel,
    dryRun: false,
    mode: 'github-api',
    files,
    prUrl,
    changelogPr,
    releaseSha,
    bumpOid: bump.oid,
    release
  };
}

function main(argv = process.argv.slice(2)) {
  const dryRun = argv.includes('--dry-run');
  const noPush = argv.includes('--no-push');
  const githubApi = argv.includes('--github-api');
  const result = githubApi
    ? createAppReleaseTagGithubApi({ dryRun })
    : createAppReleaseTag({ dryRun, push: !noPush && !dryRun });
  console.log(JSON.stringify(result, null, 2));
  return result;
}

module.exports = {
  applyLockedVersion,
  createAppReleaseTag,
  createAppReleaseTagGithubApi,
  headHasAppTag,
  main,
  openAndMergeReleasePr,
  resolveBunBinary,
  resolveSleepBinary,
  waitForPullRequestMergeable
};

if (isEntryPoint(module)) {
  main();
}
