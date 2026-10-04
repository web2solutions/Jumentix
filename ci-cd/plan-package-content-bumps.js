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

function resolveTagCommit(tagName) {
  const local = runGit(['rev-parse', '--verify', `${tagName}^{commit}`], { allowFailure: true });
  if (local) return local;

  const remote = runGit(['ls-remote', '--tags', 'origin', `refs/tags/${tagName}`], {
    allowFailure: true
  });
  const sha = String(remote || '').split(/\s+/)[0];
  if (!sha) return '';

  // Materialize the remote tag locally so subsequent diffs use a real object.
  runGit(['fetch', '--no-tags', 'origin', `${sha}:refs/tags/${tagName}`], { allowFailure: true });
  return runGit(['rev-parse', '--verify', `${tagName}^{commit}`], { allowFailure: true }) || sha;
}

function contentChangedSinceTag(tagName, watchPaths) {
  const base = resolveTagCommit(tagName);
  if (!base) {
    // No tag yet: if the version is already on npm, treat HEAD as changed so a
    // bump can republish. Caller decides via versionPublished.
    return true;
  }
  const diff = runGit(['diff', '--name-only', `${base}...HEAD`, '--', ...watchPaths], {
    allowFailure: true
  });
  return Boolean(diff);
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
  const bumps = fromPath ? readBumpPlan(fromPath) : planPackageContentBumps();
  if (bumps.length === 0) {
    console.log(JSON.stringify({ bumps: [], applied: false }, null, 2));
    return { bumps, applied: [] };
  }
  const applied = apply ? applyPackageContentBumps(bumps) : [];
  console.log(JSON.stringify({ bumps, applied: apply }, null, 2));
  return { bumps, applied };
}

module.exports = {
  applyPackageContentBumps,
  bumpPatch,
  contentChangedSinceTag,
  planPackageContentBumps,
  publishedPaths,
  readBumpPlan,
  resolveTagCommit,
  main
};

if (isEntryPoint(module)) {
  main();
}
