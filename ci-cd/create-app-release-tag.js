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
const {
  GENERATED_CHANGELOG_SYNC_BODY_PREFIX
} = require('./check-pr-governance.js');

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
    const stdout = execFileSync(ghBinary(), args, {
      encoding: 'utf8',
      cwd: options.cwd,
      env: {
        ...process.env,
        ...(options.env || {}),
        GH_TOKEN: token,
        GITHUB_TOKEN: token
      },
      // inherit returns null from execFileSync — do not call .toString() on it
      // (proven by app-release run 36023574556 after #472 squash-merged).
      stdio: options.inherit
        ? 'inherit'
        : ['ignore', 'pipe', options.allowFailure ? 'ignore' : 'pipe']
    });
    if (options.inherit) return '';
    return String(stdout || '').trim();
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

/** Build signed-commit additions without leaving a dirty worktree. */
function buildLockedVersionAdditions(rootDir, version) {
  const files = applyLockedVersion(rootDir, version);
  const relativePaths = [files.rootPackage, files.policy, ...files.apps];
  const additions = relativePaths.map((rel) => ({
    path: rel,
    contents: fs.readFileSync(path.join(rootDir, rel), 'utf8')
  }));
  resetWorktree(rootDir);
  return { files, additions, relativePaths };
}

function resetWorktree(rootDir) {
  runGit(['reset', '--hard', 'HEAD'], { cwd: rootDir, allowFailure: true });
  runGit(['clean', '-fd'], { cwd: rootDir, allowFailure: true });
}

function checkoutMainClean(rootDir) {
  resetWorktree(rootDir);
  runGit(['checkout', '-B', 'main', 'origin/main'], { cwd: rootDir });
}

function remoteTagExists(repository, tag, options = {}) {
  const env = options.env || process.env;
  if (!resolveToken(env)) {
    const sha = runGit(['rev-parse', '-q', '--verify', `refs/tags/${tag}^{}`], {
      allowFailure: true,
      cwd: options.cwd
    });
    return Boolean(sha);
  }
  const invoke = options.runGh || runGh;
  const raw = invoke([
    'api',
    `repos/${repository}/git/ref/tags/${tag}`
  ], {
    env,
    cwd: options.cwd,
    allowFailure: true
  });
  return Boolean(raw && raw.trim());
}

function ensureBranchAtSha({
  repository,
  branch,
  sha,
  env,
  cwd,
  runGh: invoke = runGh
}) {
  const created = invoke([
    'api', '-X', 'POST', `repos/${repository}/git/refs`,
    '-f', `ref=refs/heads/${branch}`,
    '-f', `sha=${sha}`
  ], { env, cwd, allowFailure: true });
  if (created) return { created: true };

  const existing = invoke([
    'api',
    `repos/${repository}/git/ref/heads/${branch}`
  ], { env, cwd, allowFailure: true });
  if (!existing) {
    throw new Error(
      `Could not create or read refs/heads/${branch} at ${sha}`
    );
  }
  return { created: false, ref: JSON.parse(existing) };
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

/**
 * Required-check failures under BLOCKED: fail immediately instead of polling
 * until the 1h timeout (proven by app-release run 36033595770 waiting on #479
 * while ci/circleci: coverage was already FAILURE).
 *
 * Match case-insensitively: Check Runs use `FAILURE`, Status contexts often
 * use `failure`, and `gh pr checks` uses `fail` (app-release run 36160574895
 * waited the full hour on #514 because lowercase Status states were ignored).
 */
function listFailedRequiredChecks(prUrl, options = {}) {
  const invoke = options.runGh || runGh;
  const rollupRaw = invoke([
    'pr', 'view', prUrl,
    '--json', 'statusCheckRollup',
    '--jq',
    '[.statusCheckRollup[]? | select('
      + '((.conclusion // .state // "") | ascii_upcase) as $s '
      + '| ($s == "FAILURE" or $s == "FAILED" or $s == "FAIL" or $s == "FAILING"'
      + ' or $s == "CANCELLED" or $s == "CANCELED" or $s == "TIMED_OUT"'
      + ' or $s == "ERROR" or $s == "ACTION_REQUIRED"))'
      + ' | {name: (.name // .context // "unknown"),'
      + ' url: (.detailsUrl // .targetUrl // "")}]'
  ], {
    env: options.env,
    cwd: options.cwd,
    allowFailure: true
  });
  const fromRollup = parseFailedCheckJson(rollupRaw);
  if (fromRollup.length > 0) return fromRollup;

  const checksRaw = invoke([
    'pr', 'checks', prUrl,
    '--json', 'name,state,link',
    '--jq',
    '[.[] | select('
      + '((.state // "") | ascii_upcase) as $s '
      + '| ($s == "FAILURE" or $s == "FAILED" or $s == "FAIL" or $s == "FAILING"'
      + ' or $s == "CANCELLED" or $s == "CANCELED" or $s == "TIMED_OUT"'
      + ' or $s == "ERROR" or $s == "ACTION_REQUIRED"))'
      + ' | {name: (.name // "unknown"), url: (.link // "")}]'
  ], {
    env: options.env,
    cwd: options.cwd,
    allowFailure: true
  });
  return parseFailedCheckJson(checksRaw);
}

function parseFailedCheckJson(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry) => {
      if (!entry || typeof entry !== 'object') return false;
      return Boolean(entry.name);
    }).map((entry) => ({
      name: String(entry.name),
      url: entry.url ? String(entry.url) : ''
    }));
  } catch {
    return [];
  }
}

function waitForPullRequestMergeable(prUrl, options = {}) {
  const timeoutMs = options.timeoutMs ?? 60 * 60 * 1000;
  const pollMs = options.pollMs ?? 30_000;
  const invoke = options.runGh || runGh;
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const state = invoke(
      ['pr', 'view', prUrl, '--json', 'mergeStateStatus', '--jq', '.mergeStateStatus'],
      { env: options.env, cwd: options.cwd }
    );
    if (state === 'CLEAN' || state === 'UNSTABLE' || state === 'HAS_HOOKS') {
      return state;
    }
    if (state === 'BLOCKED' || state === 'UNKNOWN') {
      const failed = listFailedRequiredChecks(prUrl, { ...options, runGh: invoke });
      if (failed.length > 0) {
        const detail = failed
          .map((entry) => `${entry.name}${entry.url ? ` (${entry.url})` : ''}`)
          .join('; ');
        throw new Error(
          `Required checks failed on ${prUrl}: ${detail}`
        );
      }
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
  // Close older matching PRs so a failed generation cannot block forever —
  // but keep an open PR already on this exact head branch (retry path).
  const prior = runGh([
    'pr', 'list', '--base', 'main', '--state', 'open',
    '--json', 'number,headRefName',
    '--jq',
    `.[] | select(.headRefName != "${branch}"`
      + ` and (.headRefName | test("${priorHeadRegex}"))) | .number`
  ], { env, cwd, allowFailure: true });
  for (const number of prior.split('\n').map((s) => s.trim()).filter(Boolean)) {
    runGh(['pr', 'close', number, '--delete-branch'], { env, cwd, allowFailure: true });
  }

  const existingUrl = runGh([
    'pr', 'list',
    '--base', 'main',
    '--head', branch,
    '--state', 'open',
    '--json', 'url',
    '--jq', '.[0].url // empty'
  ], { env, cwd, allowFailure: true });

  const prUrl = existingUrl || runGh([
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
  const hasTag = options.headHasAppTag || headHasAppTag;
  const existing = hasTag(rootDir);
  if (existing) {
    return {
      action: 'noop',
      reason: 'head-already-tagged',
      tag: existing,
      dryRun,
      mode: 'github-api'
    };
  }

  const tagExists = options.remoteTagExists || remoteTagExists;
  const policy = readJson(path.join(rootDir, 'release-policy.json'));
  const lockedTag = `v${policy.appLockedVersion}`;
  const rootVersion = readJson(path.join(rootDir, 'package.json')).version;
  const lockedTagMissing = !tagExists(repository, lockedTag, { env, cwd: rootDir, runGh });

  // Prefer tagging a locked version that never received its tag over bumping
  // again (dirty-checkout after merge spun v0.2.2…v0.2.15 without tags).
  if (rootVersion === policy.appLockedVersion && lockedTagMissing) {
    const plan = {
      action: 'create',
      tag: lockedTag,
      version: policy.appLockedVersion,
      baseVersion: policy.appLockedVersion,
      bumpLevel: null,
      dryRun,
      mode: 'github-api',
      reason: 'tag-missing-locked-version'
    };
    if (dryRun) return plan;

    runGit(['fetch', '--tags', '--prune', 'origin'], { cwd: rootDir, allowFailure: true });
    runGit(['fetch', 'origin', 'main'], { cwd: rootDir, allowFailure: true });
    checkoutMainClean(rootDir);

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

    const policyOnMain = readJson(path.join(rootDir, 'release-policy.json'));
    const lockedOnMain = policyOnMain.appLockedVersion;
    const lockedTagOnMain = `v${lockedOnMain}`;
    const rootVersionOnMain = readJson(path.join(rootDir, 'package.json')).version;
    if (
      rootVersionOnMain === lockedOnMain
      && !tagExists(repository, lockedTagOnMain, { env, cwd: rootDir, runGh })
    ) {
      const releaseSha = runGit(['rev-parse', 'HEAD'], { cwd: rootDir });
      createAnnotatedTagRef({
        repository,
        tag: lockedTagOnMain,
        message: `Application release ${lockedTagOnMain}`,
        commitSha: releaseSha,
        env
      });
      const changelogPr = syncChangelogAfterTag({
        repository,
        tagName: lockedTagOnMain,
        releaseSha,
        rootDir,
        env,
        wait: options.waitForPullRequestMergeable || waitForPullRequestMergeable
      });
      const release = createGithubRelease({
        tagName: lockedTagOnMain,
        rootDir,
        env
      });
      return {
        action: 'create',
        tag: lockedTagOnMain,
        version: lockedOnMain,
        baseVersion: lockedOnMain,
        bumpLevel: null,
        dryRun: false,
        mode: 'github-api',
        reason: 'tag-missing-locked-version',
        prUrl: null,
        changelogPr,
        releaseSha,
        release
      };
    }
  }

  const resolveNext = options.resolveNextVersion || resolveNextVersionFromRepo;
  const next = resolveNext({ rootDir });
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
    mode: 'github-api',
    reason: next.reason
  };

  if (dryRun) {
    return plan;
  }

  runGit(['fetch', '--tags', '--prune', 'origin'], { cwd: rootDir, allowFailure: true });
  runGit(['fetch', 'origin', 'main'], { cwd: rootDir, allowFailure: true });
  checkoutMainClean(rootDir);

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

  const policyOnMain = readJson(path.join(rootDir, 'release-policy.json'));
  const lockedOnMain = policyOnMain.appLockedVersion;
  const lockedTagOnMain = `v${lockedOnMain}`;
  const rootVersionOnMain = readJson(path.join(rootDir, 'package.json')).version;
  if (
    rootVersionOnMain === lockedOnMain
    && !tagExists(repository, lockedTagOnMain, { env, cwd: rootDir, runGh })
  ) {
    const releaseSha = runGit(['rev-parse', 'HEAD'], { cwd: rootDir });
    createAnnotatedTagRef({
      repository,
      tag: lockedTagOnMain,
      message: `Application release ${lockedTagOnMain}`,
      commitSha: releaseSha,
      env
    });
    const changelogPr = syncChangelogAfterTag({
      repository,
      tagName: lockedTagOnMain,
      releaseSha,
      rootDir,
      env,
      wait: options.waitForPullRequestMergeable || waitForPullRequestMergeable
    });
    const release = createGithubRelease({
      tagName: lockedTagOnMain,
      rootDir,
      env
    });
    return {
      action: 'create',
      tag: lockedTagOnMain,
      version: lockedOnMain,
      baseVersion: lockedOnMain,
      bumpLevel: null,
      dryRun: false,
      mode: 'github-api',
      reason: 'tag-missing-locked-version',
      prUrl: null,
      changelogPr,
      releaseSha,
      release
    };
  }

  const nextOnMain = resolveNext({ rootDir });
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
  const { files, additions } = buildLockedVersionAdditions(rootDir, nextOnMain.nextVersion);

  ensureBranchAtSha({
    repository,
    branch,
    sha: mainSha,
    env,
    cwd: rootDir
  });

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
  checkoutMainClean(rootDir);
  const releaseSha = runGit(['rev-parse', 'HEAD'], { cwd: rootDir });

  createAnnotatedTagRef({
    repository,
    tag: tagOnMain,
    message: `Application release ${tagOnMain}`,
    commitSha: releaseSha,
    env
  });

  const changelogPr = syncChangelogAfterTag({
    repository,
    tagName: tagOnMain,
    releaseSha,
    rootDir,
    env,
    wait: options.waitForPullRequestMergeable || waitForPullRequestMergeable
  });

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

function syncChangelogAfterTag({
  repository,
  tagName,
  releaseSha,
  rootDir,
  env,
  wait = waitForPullRequestMergeable
}) {
  runGit(['fetch', '--tags', '--prune', 'origin'], { cwd: rootDir, allowFailure: true });
  execFileSync(resolveBunBinary(), [path.join(rootDir, 'ci-cd/update-changelog.js')], {
    cwd: rootDir,
    stdio: 'inherit'
  });

  const changelogStatus = runGit(['status', '--porcelain', '--', 'CHANGELOG.md'], {
    allowFailure: true,
    cwd: rootDir
  });
  if (!changelogStatus) return null;

  const changelogBranch = `chore/changelog-sync-${releaseSha.slice(0, 8)}`;
  const contents = fs.readFileSync(path.join(rootDir, 'CHANGELOG.md'), 'utf8');
  resetWorktree(rootDir);

  ensureBranchAtSha({
    repository,
    branch: changelogBranch,
    sha: releaseSha,
    env,
    cwd: rootDir
  });
  createSignedCommitOnBranchWithGh({
    repository,
    branch: changelogBranch,
    expectedHeadOid: releaseSha,
    headline: 'chore: synchronize changelog',
    additions: [{ path: 'CHANGELOG.md', contents }],
    env
  });
  const changelogPr = openAndMergeReleasePr({
    branch: changelogBranch,
    title: 'chore: synchronize changelog',
    body: [
      GENERATED_CHANGELOG_SYNC_BODY_PREFIX,
      '',
      `Application tag \`${tagName}\` (JUM-889).`
    ].join('\n'),
    env,
    cwd: rootDir,
    priorHeadRegex: '^chore/changelog-sync-[0-9a-f]{8}$',
    wait
  });
  runGit(['fetch', 'origin', 'main'], { cwd: rootDir });
  checkoutMainClean(rootDir);
  return changelogPr;
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
  buildLockedVersionAdditions,
  ensureBranchAtSha,
  listFailedRequiredChecks,
  remoteTagExists,
  resetWorktree,
  runGh,
  createAppReleaseTag,
  createAppReleaseTagGithubApi,
  headHasAppTag,
  main,
  openAndMergeReleasePr,
  parseFailedCheckJson,
  resolveBunBinary,
  resolveSleepBinary,
  syncChangelogAfterTag,
  waitForPullRequestMergeable
};

if (isEntryPoint(module)) {
  main();
}
