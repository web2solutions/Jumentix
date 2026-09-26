/* eslint-disable no-console */
/**
 * Publish an npm release cohort with a re-publish guard and per-package tags
 * (JUM-886 / Requirement 070 additive tagging).
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { gitBinary } = require('./lib/git-binary.js');
const { isEntryPoint } = require('./lib/entry-point.js');
const { resolveNpmCommand } = require('./check-npm-org-integration.js');

const ROOT = path.resolve(__dirname, '..');

const COHORTS = {
  all: [
    'cana', 'cana-react', 'cana-vue', 'designer-core', 'persistence-contracts',
    'shared-contracts', 'external-persistence-core', 'external-store-proxy',
    'external-db-repositories', 'key-value-storage', 'database-client-factory',
    'message-mediator', 'mutex-service', 'dead-letter-queue', 'runtime-infra',
    'adapter-runtime-bootstrap', 'sdk-grpc-client', 'sdk-rest-client',
    'sdk-websocket-client', 'cli-init'
  ],
  cana: ['cana', 'cana-react', 'cana-vue'],
  'designer-core': ['designer-core'],
  runtime: [
    'persistence-contracts', 'shared-contracts', 'external-persistence-core',
    'external-store-proxy', 'external-db-repositories', 'key-value-storage',
    'database-client-factory', 'message-mediator', 'mutex-service',
    'dead-letter-queue', 'runtime-infra', 'adapter-runtime-bootstrap'
  ],
  sdks: [
    'shared-contracts', 'sdk-grpc-client', 'sdk-rest-client', 'sdk-websocket-client'
  ],
  'cli-init': ['cli-init']
};

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

function packageTagName(packageName, version) {
  return `${packageName}@${version}`;
}

function remoteTagExists(tagName) {
  const local = runGit(['rev-parse', '--verify', `refs/tags/${tagName}`], {
    allowFailure: true
  });
  if (local) return true;
  const remote = runGit(['ls-remote', '--tags', 'origin', `refs/tags/${tagName}`], {
    allowFailure: true
  });
  return Boolean(remote && remote.includes(tagName));
}

function readPackageMeta(dirName) {
  const pkgPath = path.join(ROOT, 'packages', dirName, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  return {
    dirName,
    name: pkg.name,
    version: pkg.version,
    tag: packageTagName(pkg.name, pkg.version),
    cwd: path.join(ROOT, 'packages', dirName)
  };
}

/**
 * Default side effects. Injected in the suite so every branch runs without npm,
 * git or the network.
 */
function defaultPublishIo() {
  return {
    tagExists: remoteTagExists,
    versionPublished(name, version) {
      const npm = resolveNpmCommand();
      try {
        const out = execFileSync(npm.command, [...npm.argsPrefix, 'view', `${name}@${version}`, 'version'], {
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe']
        }).toString().trim();
        return out === version;
      } catch (error) {
        const stderr = String(error.stderr || '');
        if (/E404|404 Not Found|is not in this registry|No match found/i.test(stderr)) return false;
        throw new Error(`npm view ${name}@${version} failed: ${stderr.trim() || error.message}`);
      }
    },
    pack(meta) {
      // bun pm pack rewrites workspace:* to concrete versions; npm publish run
      // inside the package directory would ship the workspace protocol verbatim
      // and every consumer install would fail (JUM-894).
      const { buildAndPack } = require('./check-npm-package-release.js');
      const destination = fs.mkdtempSync(path.join(os.tmpdir(), 'jumentix-publish-'));
      return buildAndPack(meta.cwd, destination).tarball;
    },
    publish(tarball) {
      const npm = resolveNpmCommand();
      execFileSync(npm.command, [...npm.argsPrefix, 'publish', tarball, '--access', 'public'], {
        cwd: ROOT,
        stdio: 'inherit',
        env: process.env
      });
    },
    tag(tagName) {
      runGit(['tag', '-a', tagName, '-m', `npm publish ${tagName}`]);
      runGit(['push', 'origin', tagName], { inherit: true });
    },
    log: console.log
  };
}

function publishPackage(meta, options = {}) {
  const dryRun = Boolean(options.dryRun);
  const io = { ...defaultPublishIo(), ...(options.io || {}) };
  if (io.tagExists(meta.tag)) {
    io.log(`[skip] ${meta.tag} already tagged — treating as published (no-op).`);
    return { action: 'skip', reason: 'tag-exists', package: meta.name, tag: meta.tag };
  }

  if (io.versionPublished(meta.name, meta.version)) {
    // Published earlier but the tag push failed or never ran: repair the tag
    // instead of failing every later release on EPUBLISHCONFLICT.
    if (dryRun) {
      io.log(`[dry-run] ${meta.name}@${meta.version} already on npm; would tag ${meta.tag}`);
      return { action: 'dry-run', reason: 'already-published', package: meta.name, tag: meta.tag };
    }
    io.tag(meta.tag);
    io.log(`[skip] ${meta.name}@${meta.version} already on npm — tagged ${meta.tag}`);
    return { action: 'skip', reason: 'already-published', package: meta.name, tag: meta.tag };
  }

  if (dryRun) {
    io.log(`[dry-run] would publish ${meta.name}@${meta.version} and tag ${meta.tag}`);
    return { action: 'dry-run', package: meta.name, tag: meta.tag };
  }

  const tarball = io.pack(meta);
  io.publish(tarball);
  io.tag(meta.tag);
  io.log(`[ok] published and tagged ${meta.tag}`);
  return { action: 'published', package: meta.name, tag: meta.tag };
}

function resolveCohort(name) {
  const packages = COHORTS[name];
  if (!packages) {
    throw new Error(`Unsupported release cohort: ${name}`);
  }
  return packages;
}

function publishNpmCohort(cohortName, options = {}) {
  const dirs = resolveCohort(cohortName);
  const results = [];
  for (const dirName of dirs) {
    const meta = options.readMeta ? options.readMeta(dirName) : readPackageMeta(dirName);
    results.push(publishPackage(meta, options));
  }
  return { cohort: cohortName, results };
}

function main(argv = process.argv.slice(2)) {
  const dryRun = argv.includes('--dry-run');
  const cohort = argv.find((arg) => !arg.startsWith('-')) || process.env.RELEASE || 'all';
  const summary = publishNpmCohort(cohort, { dryRun });
  console.log(JSON.stringify({
    cohort: summary.cohort,
    published: summary.results.filter((r) => r.action === 'published').length,
    skipped: summary.results.filter((r) => r.action === 'skip').length,
    dryRun: summary.results.filter((r) => r.action === 'dry-run').length
  }, null, 2));
  return summary;
}

module.exports = {
  COHORTS,
  defaultPublishIo,
  packageTagName,
  publishNpmCohort,
  publishPackage,
  readPackageMeta,
  remoteTagExists,
  resolveCohort,
  main
};

if (isEntryPoint(module)) {
  main();
}
