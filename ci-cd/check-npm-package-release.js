#!/usr/bin/env node
/* eslint-disable no-console */
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const PACKAGES_DIR = path.join(ROOT, 'packages');
const REQUIRED_TOP_LEVEL_FILES = new Set(['package.json', 'README.md', 'LICENSE.md']);
const PUBLIC_PACKAGE_NAMES = [
  '@jumentix/cana',
  '@jumentix/cana-react',
  '@jumentix/cana-vue',
  '@jumentix/designer-core'
];
const SMOKE_IMPORTS = {
  '@jumentix/cana': ['@jumentix/cana'],
  '@jumentix/cana-react': ['@jumentix/cana-react', '@jumentix/cana-react/redux'],
  '@jumentix/cana-vue': ['@jumentix/cana-vue'],
  '@jumentix/designer-core': ['@jumentix/designer-core']
};

function run(command, args, cwd, options = {}) {
  return execFileSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: options.stdio || ['ignore', 'pipe', 'pipe']
  });
}

function discoverPublishablePackages(root = ROOT) {
  const packageManifests = fs.readdirSync(path.join(root, 'packages'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(root, 'packages', entry.name))
    .map((directory) => ({
      directory,
      manifest: JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8'))
    }));
  const unexpected = packageManifests
    .filter(({ manifest }) => manifest.private !== true && !PUBLIC_PACKAGE_NAMES.includes(manifest.name))
    .map(({ manifest }) => manifest.name);
  if (unexpected.length > 0) {
    throw new Error(`Unexpected public npm packages: ${unexpected.join(', ')}. Update the release cohort policy first.`);
  }
  const directories = new Map(packageManifests.map(({ directory, manifest }) => [manifest.name, directory]));
  const missing = PUBLIC_PACKAGE_NAMES.filter((name) => !directories.has(name));
  if (missing.length > 0) throw new Error(`Missing public npm packages: ${missing.join(', ')}.`);
  return PUBLIC_PACKAGE_NAMES.map((name) => directories.get(name));
}

function validateManifest(manifest, directory) {
  const failures = [];
  if (!PUBLIC_PACKAGE_NAMES.includes(manifest.name)) failures.push('is not approved for the public release cohort');
  if (!manifest.name?.startsWith('@jumentix/')) failures.push('must use the @jumentix scope');
  if (manifest.private === true) failures.push('must not be private');
  if (manifest.publishConfig?.access !== 'public') failures.push('must set publishConfig.access to public');
  if (!manifest.repository?.url?.includes('github.com/web2solutions/Jumentix')) failures.push('must declare the canonical repository');
  if (manifest.repository?.directory !== path.relative(ROOT, directory)) failures.push('must declare its repository directory');
  if (!manifest.homepage || !manifest.bugs?.url) failures.push('must declare homepage and issue tracker');
  if (manifest.license !== 'MIT') failures.push('must declare the MIT license');
  if (!Array.isArray(manifest.files) || !manifest.files.includes('dist')) failures.push('must whitelist dist');
  if (!manifest.scripts?.build || !manifest.scripts?.clean || !manifest.scripts?.prepublishOnly?.includes('bun run')) failures.push('must clean and build through Bun before publishing');
  return failures;
}

function assertTarballContents(manifest, packument) {
  const files = packument.files.map((file) => file.path);
  const missing = [...REQUIRED_TOP_LEVEL_FILES].filter((file) => !files.includes(file));
  if (missing.length > 0 || !files.some((file) => file.startsWith('dist/'))) {
    throw new Error(`${manifest.name} tarball is missing required public artifacts`);
  }
  const forbidden = files.filter((file) => /^(src|test|scripts)\//.test(file) || file.includes('.env'));
  if (forbidden.length > 0) throw new Error(`${manifest.name} tarball contains forbidden files: ${forbidden.join(', ')}`);
}

function buildAndPack(directory, tarballsDirectory) {
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8'));
  const failures = validateManifest(manifest, directory);
  if (failures.length > 0) throw new Error(`${manifest.name}: ${failures.join('; ')}`);

  run('bun', ['run', 'clean'], directory, { stdio: 'inherit' });
  run('bun', ['run', 'build'], directory, { stdio: 'inherit' });
  const output = run('npm', ['pack', '--json', `--pack-destination=${tarballsDirectory}`], directory);
  const [packument] = JSON.parse(output);
  assertTarballContents(manifest, packument);
  return { manifest, tarball: path.join(tarballsDirectory, packument.filename) };
}

function smokeInstall(packages, consumerDirectory) {
  fs.writeFileSync(path.join(consumerDirectory, 'package.json'), '{"private":true,"type":"module"}\n');
  run('npm', ['install', '--ignore-scripts', '--no-package-lock', ...packages.map((entry) => entry.tarball)], consumerDirectory, { stdio: 'inherit' });
  const imports = packages.flatMap((entry) => SMOKE_IMPORTS[entry.manifest.name] || [entry.manifest.name]);
  run('node', ['--input-type=module', '--eval', `await Promise.all(${JSON.stringify(imports)}.map((specifier) => import(specifier)));`], consumerDirectory, { stdio: 'inherit' });
}

function runReleaseCheck() {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'jumentix-npm-release-'));
  try {
    const tarballsDirectory = path.join(temporaryDirectory, 'tarballs');
    const consumerDirectory = path.join(temporaryDirectory, 'consumer');
    fs.mkdirSync(tarballsDirectory);
    fs.mkdirSync(consumerDirectory);
    const packages = discoverPublishablePackages().map((directory) => buildAndPack(directory, tarballsDirectory));
    smokeInstall(packages, consumerDirectory);
    console.log(`[npm-release] verified ${packages.length} public package tarballs in an external consumer.`);
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

if (require.main === module) runReleaseCheck();

module.exports = { PUBLIC_PACKAGE_NAMES, discoverPublishablePackages, validateManifest, assertTarballContents, runReleaseCheck };
