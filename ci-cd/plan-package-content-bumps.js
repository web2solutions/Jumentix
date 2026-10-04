/* eslint-disable no-console */
/**
 * Detect public packages whose published surface changed since the version
 * currently declared in package.json is already on npm (JUM-917 / Req 070).
 *
 * Independent package versioning means content can land on `main` without a
 * bump; npm-publish then skips. This planner lists the patch bumps required so
 * automation can open a PR and the existing publish path ships the content.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { gitBinary } = require('./lib/git-binary.js');
const { isEntryPoint } = require('./lib/entry-point.js');
const { COHORTS, packageTagName, readPackageMeta } = require('./publish-npm-cohort.js');

const ROOT = path.resolve(__dirname, '..');

function runGit(args, options = {}) {
  try {
    return execFileSync(gitBinary(), args, {
      encoding: 'utf8',
      stdio: options.inherit ? 'inherit' : ['ignore', 'pipe', options.allowFailure ? 'ignore' : 'pipe'],
      cwd: options.cwd || ROOT
    }).toString().trim();
  } catch (error) {
    if (options.allowFailure) return '';
    throw error;
  }
}

function bumpPatch(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(String(version || ''));
  if (!match) {
    throw new Error(`invalid semver version for patch bump: ${version}`);
  }
  return `${match[1]}.${match[2]}.${Number(match[3]) + 1}`;
}

function publishedPaths(dirName, pkg) {
  const files = Array.isArray(pkg.files) ? pkg.files : [];
  const roots = files.length > 0 ? files : ['.'];
  const paths = new Set([
    `packages/${dirName}/package.json`,
    `packages/${dirName}/README.md`,
    `packages/${dirName}/README.pt-BR.md`
  ]);
  for (const entry of roots) {
    const normalized = String(entry).replace(/^\.\//, '').replace(/\/$/, '');
    if (!normalized || normalized === '.') {
      paths.add(`packages/${dirName}`);
      continue;
    }
    paths.add(`packages/${dirName}/${normalized}`);
  }
  return [...paths];
}

function tagExists(tagName) {
  const local = runGit(['rev-parse', '--verify', `refs/tags/${tagName}`], { allowFailure: true });
  if (local) return true;
  const remote = runGit(['ls-remote', '--tags', 'origin', `refs/tags/${tagName}`], {
    allowFailure: true
  });
  return Boolean(remote && remote.includes(tagName));
}

/**
 * Parse `git ls-remote --tags` output into the peeled commit SHA for a tag.
 * Annotated tags emit both `<tag-object> refs/tags/name` and
 * `<commit> refs/tags/name^{}`; prefer the peeled line so diffs never use the
 * annotated tag object as a commit base.
 */
function peelRemoteTagSha(lsRemoteOutput, tagName) {
  const lines = String(lsRemoteOutput || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const peeled = `refs/tags/${tagName}^{}`;
  const exact = `refs/tags/${tagName}`;
  for (const line of lines) {
    const [sha, ref] = line.split(/\s+/);
    if (sha && ref === peeled) return sha;
  }
  for (const line of lines) {
    const [sha, ref] = line.split(/\s+/);
    if (sha && ref === exact) return sha;
  }
  return '';
}

function resolveTagCommit(tagName) {
  const local = runGit(['rev-parse', '--verify', `${tagName}^{commit}`], { allowFailure: true });
  if (local) return local;

  // Fetch the tag by ref name so annotated tags materialize and peel correctly.
  runGit(['fetch', '--no-tags', 'origin', `refs/tags/${tagName}:refs/tags/${tagName}`], {
    allowFailure: true
  });
  const afterFetch = runGit(['rev-parse', '--verify', `${tagName}^{commit}`], { allowFailure: true });
  if (afterFetch) return afterFetch;

  const remote = runGit(['ls-remote', '--tags', 'origin', `refs/tags/${tagName}`], {
    allowFailure: true
  });
  return peelRemoteTagSha(remote, tagName);
}

function contentChangedSinceTag(tagName, watchPaths) {
  const base = resolveTagCommit(tagName);
  if (!base) {
    // No tag yet: if the version is already on npm, treat HEAD as changed so a
    // bump can republish. Caller decides via versionPublished.
    return true;
  }
  try {
    const diff = runGit(['diff', '--name-only', `${base}...HEAD`, '--', ...watchPaths]);
    return Boolean(diff);
  } catch {
    // Fail open toward a bump when the base is unusable (e.g. tag object SHA).
    return true;
  }
}

function planPackageContentBumps(options = {}) {
  const dirs = options.dirs || COHORTS.all;
  const readMeta = options.readMeta || readPackageMeta;
  const versionPublished = options.versionPublished || ((name, version) => {
    try {
      const { resolveNpmCommand } = require('./check-npm-org-integration.js');
      const npm = resolveNpmCommand();
      const out = execFileSync(npm.command, [...npm.argsPrefix, 'view', `${name}@${version}`, 'version'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe']
      }).toString().trim();
      return out === version;
    } catch (error) {
      const stderr = String(error.stderr || '');
      if (/E404|404 Not Found|is not in this registry|No match found/i.test(stderr)) return false;
      throw error;
    }
  });

  const bumps = [];
  for (const dirName of dirs) {
    const meta = readMeta(dirName);
    const pkgPath = path.join(ROOT, 'packages', dirName, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const onNpm = versionPublished(meta.name, meta.version);
    if (!onNpm) {
      // Unpublished version will ship on the next npm-publish run.
      continue;
    }
    const watchPaths = publishedPaths(dirName, pkg);
    const tag = packageTagName(meta.name, meta.version);
    if (!contentChangedSinceTag(tag, watchPaths)) continue;
    bumps.push({
      dirName,
      name: meta.name,
      from: meta.version,
      to: bumpPatch(meta.version),
      packageJsonPath: `packages/${dirName}/package.json`,
      reason: `published surface changed since ${tag}`
    });
  }
  return bumps;
}

function applyPackageContentBumps(bumps, options = {}) {
  const root = options.root || ROOT;
  const applied = [];
  for (const bump of bumps) {
    const absolute = path.join(root, bump.packageJsonPath);
    const pkg = JSON.parse(fs.readFileSync(absolute, 'utf8'));
    if (pkg.version !== bump.from) {
      throw new Error(
        `${bump.packageJsonPath} expected version ${bump.from}, found ${pkg.version}`
      );
    }
    pkg.version = bump.to;
    fs.writeFileSync(absolute, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
    applied.push(bump);
  }

  // Keep cli-init packageVersions in sync so GENERATED_AUTOMATION_QUALITY_GATE's
  // cli:check-template-freshness preflight stays green (Bugbot on #608).
  if (applied.length > 0 && options.syncCliManifest !== false) {
    const { collectPackageVersions } = require('../packages/cli-init/scripts/build-templates.js');
    const manifestPath = path.join(root, 'packages/cli-init/templates.manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    manifest.packageVersions = collectPackageVersions(root);
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  }

  return applied;
}

function readBumpPlan(filePath) {
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!Array.isArray(parsed.bumps)) {
    throw new Error(`bump plan ${filePath} must contain a bumps array`);
  }
  return parsed.bumps;
}

function main(argv = process.argv.slice(2)) {
  const apply = argv.includes('--apply');
  const fromIndex = argv.indexOf('--from');
  const fromPath = fromIndex >= 0 ? argv[fromIndex + 1] : '';
  const outIndex = argv.indexOf('--out');
  const outPath = outIndex >= 0 ? argv[outIndex + 1] : '';
  const bumps = fromPath ? readBumpPlan(fromPath) : planPackageContentBumps();
  const payload = { bumps, applied: false };
  if (bumps.length === 0) {
    if (outPath) {
      fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    }
    // Summary only — never dump bump objects to logs (Sonar jssecurity:S8689).
    console.log(JSON.stringify({ bumpCount: 0, packages: [], applied: false }));
    return { bumps, applied: [] };
  }
  const applied = apply ? applyPackageContentBumps(bumps) : [];
  payload.applied = apply;
  if (outPath) {
    fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  }
  console.log(JSON.stringify({
    bumpCount: bumps.length,
    packages: bumps.map((bump) => `${bump.name}: ${bump.from} -> ${bump.to}`),
    applied: apply
  }));
  return { bumps, applied };
}

module.exports = {
  applyPackageContentBumps,
  bumpPatch,
  contentChangedSinceTag,
  peelRemoteTagSha,
  planPackageContentBumps,
  publishedPaths,
  readBumpPlan,
  resolveTagCommit,
  main
};

if (isEntryPoint(module)) {
  main();
}
