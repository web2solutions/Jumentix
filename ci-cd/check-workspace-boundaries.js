/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { isEntryPoint } = require('./lib/entry-point.js');

const SUPPORTED_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];
const IGNORE_DIRS = new Set([
  'node_modules',
  '.git',
  '.build',
  'coverage',
  '.tmp',
  'dist',
  // Packaged CLI seed slices (JUM-845): opaque data under packages/cli-init/templates,
  // not package source. Seeds keep their real homes under apps/*.
  'templates'
]);
const IMPORT_REGEX = /from\s+['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
/**
 * Files allowed to reach into the application through the `@src` alias.
 *
 * Empty, and that is the state to keep it in.
 *
 * It held one entry — `external-store-proxy/src/ExternalStoreProxy.ts` — with
 * no date, no issue and no reason recorded, so nothing made it expire. The
 * three database errors it needed now live in `@jumentix/persistence-contracts`
 * (JUM-601), and the package can be built and published on its own for the
 * first time.
 *
 * Adding an entry here means declaring that a library depends on an
 * application, which is the boundary this check exists to hold. It needs a
 * date, an issue and a reason at minimum, and a plan to remove it.
 */
const SRC_ALIAS_BRIDGE_ALLOWLIST = new Set([]);

function collectSourceFiles(rootDir, sourceDir, files = []) {
  const dirPath = path.join(rootDir, sourceDir);
  if (!fs.existsSync(dirPath)) return files;

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (IGNORE_DIRS.has(entry.name)) continue;
    const absPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      collectSourceFiles(rootDir, path.join(sourceDir, entry.name), files);
      continue;
    }
    if (SUPPORTED_EXTENSIONS.includes(path.extname(entry.name))) {
      files.push(absPath);
    }
  }
  return files;
}

function readImports(source) {
  const imports = [];
  let match = IMPORT_REGEX.exec(source);
  while (match) {
    imports.push(match[1] || match[2]);
    match = IMPORT_REGEX.exec(source);
  }
  return imports;
}

function readWorkspaceManifest(rootDir, relativeWorkspacePath) {
  const manifestPath = path.join(rootDir, relativeWorkspacePath, 'package.json');
  if (!fs.existsSync(manifestPath)) return null;
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
}

function workspaceManifests(rootDir) {
  const roots = ['apps', 'packages'];
  return roots.flatMap((root) => {
    const absoluteRoot = path.join(rootDir, root);
    if (!fs.existsSync(absoluteRoot)) return [];
    return fs.readdirSync(absoluteRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => {
        const relativePath = path.join(root, entry.name);
        const manifest = readWorkspaceManifest(rootDir, relativePath);
        return manifest?.name ? { manifest, relativePath } : null;
      })
      .filter(Boolean);
  });
}

function workspaceDependencyViolations({ rootDir, filePath, imports, manifests }) {
  const relativeFilePath = path.relative(rootDir, filePath);
  const workspace = manifests.find(({ relativePath }) => (
    relativeFilePath === relativePath || relativeFilePath.startsWith(`${relativePath}${path.sep}`)
  ));
  if (!workspace) return [];

  const usesTestDependency = relativeFilePath.includes(`${path.sep}test${path.sep}`);
  const declared = {
    ...(workspace.manifest.dependencies || {}),
    ...(workspace.manifest.optionalDependencies || {}),
    ...(workspace.manifest.peerDependencies || {}),
    ...(usesTestDependency ? (workspace.manifest.devDependencies || {}) : {})
  };
  const localPackages = new Set(manifests.map(({ manifest }) => manifest.name));
  const violations = [];
  for (const importPath of imports) {
    if (!localPackages.has(importPath) || importPath === workspace.manifest.name) continue;
    if (!Object.prototype.hasOwnProperty.call(declared, importPath)) {
      violations.push(
        `${relativeFilePath}: ${importPath} is a local workspace dependency and must be declared in ${workspace.relativePath}/package.json`
      );
    }
  }
  return violations;
}

function classifyZone(relativeFilePath) {
  if (relativeFilePath.startsWith(`apps${path.sep}backend-template${path.sep}`)) return 'backend';
  if (relativeFilePath.startsWith(`apps${path.sep}service-management${path.sep}`)) return 'service-management';
  if (relativeFilePath.startsWith(`packages${path.sep}`)) return 'package';
  if (relativeFilePath.startsWith(`sdk-clients${path.sep}`)) return 'legacy-sdk';
  return 'other';
}

function normalizeImportTarget(currentFile, importPath) {
  if (!importPath.startsWith('.')) return null;
  return path.resolve(path.dirname(currentFile), importPath);
}

function validateImport({
  rootDir,
  currentFile,
  relativeFilePath,
  importPath
}) {
  const zone = classifyZone(relativeFilePath);
  const violations = [];
  const normalized = importPath.replace(/\\/g, '/');

  const srcAliasAllowed = SRC_ALIAS_BRIDGE_ALLOWLIST.has(relativeFilePath);
  if (zone !== 'backend' && normalized.startsWith('@src/') && !srcAliasAllowed) {
    violations.push(`${relativeFilePath}: @src alias is only allowed inside apps/backend-template`);
  }

  if (zone !== 'legacy-sdk' && (normalized.startsWith('sdk-clients/') || normalized.includes('/sdk-clients/'))) {
    violations.push(`${relativeFilePath}: legacy sdk-clients import is forbidden ("${importPath}")`);
  }

  const resolvedRelative = normalizeImportTarget(currentFile, importPath);
  if (!resolvedRelative) return violations;

  const resolved = path.relative(rootDir, resolvedRelative);
  if (resolved.startsWith('..')) return violations;

  if (zone === 'package' && resolved.startsWith(`apps${path.sep}`)) {
    violations.push(`${relativeFilePath}: packages must not import from apps ("${importPath}")`);
  }

  if (zone === 'service-management'
    && resolved.startsWith(`apps${path.sep}backend-template${path.sep}`)) {
    violations.push(`${relativeFilePath}: service-management must not import backend-template internals ("${importPath}")`);
  }

  return violations;
}

function run() {
  const rootDir = process.cwd();
  const targets = [
    path.join('apps', 'backend-template'),
    path.join('apps', 'service-management'),
    'packages'
  ];
  const files = targets.flatMap((target) => collectSourceFiles(rootDir, target));
  const manifests = workspaceManifests(rootDir);
  const violations = [];

  for (const filePath of files) {
    const source = fs.readFileSync(filePath, 'utf8');
    const imports = readImports(source);
    const relativeFilePath = path.relative(rootDir, filePath);

    for (const importPath of imports) {
      violations.push(...validateImport({
        rootDir,
        currentFile: filePath,
        relativeFilePath,
        importPath
      }));
    }
    violations.push(...workspaceDependencyViolations({ rootDir, filePath, imports, manifests }));
  }

  if (violations.length > 0) {
    console.error('Workspace boundary violations found:');
    violations.forEach((violation) => console.error(`- ${violation}`));
    process.exit(1);
  }

  console.log('Workspace boundary check passed.');
}

if (isEntryPoint(module)) {
  run();
}

module.exports = {
  classifyZone,
  collectSourceFiles,
  readImports,
  workspaceDependencyViolations,
  workspaceManifests,
  validateImport
};
