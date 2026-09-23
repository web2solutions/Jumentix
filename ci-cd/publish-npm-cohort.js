/* eslint-disable no-console */
/**
 * Publish an npm release cohort with a re-publish guard and per-package tags
 * (JUM-886 / Requirement 070 additive tagging).
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { gitBinary } = require('./lib/git-binary.js');
const { isEntryPoint } = require('./lib/entry-point.js');

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

function publishPackage(meta, options = {}) {
  const dryRun = Boolean(options.dryRun);
  if (remoteTagExists(meta.tag)) {
    console.log(`[skip] ${meta.tag} already tagged — treating as published (no-op).`);
    return { action: 'skip', reason: 'tag-exists', package: meta.name, tag: meta.tag };
  }

  if (dryRun) {
    console.log(`[dry-run] would publish ${meta.name}@${meta.version} and tag ${meta.tag}`);
    return { action: 'dry-run', package: meta.name, tag: meta.tag };
  }

  execFileSync('npm', ['publish', '--access', 'public'], {
    cwd: meta.cwd,
    stdio: 'inherit',
    env: process.env
  });

  runGit(['tag', '-a', meta.tag, '-m', `npm publish ${meta.tag}`]);
  runGit(['push', 'origin', meta.tag], { inherit: true });
  console.log(`[ok] published and tagged ${meta.tag}`);
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
    const meta = readPackageMeta(dirName);
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
