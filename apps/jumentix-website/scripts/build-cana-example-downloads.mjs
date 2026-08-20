#!/usr/bin/env bun
/* eslint-disable no-console */
import {
  cpSync,
  existsSync,
  mkdirSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { spawnSync } from 'node:child_process';
import { CANA_FRAMEWORK_EXAMPLES } from '../components/cana-framework/catalog.ts';

const root = process.cwd();
const monorepoRoot = join(root, '../..');
const outputDir = join(root, 'public', 'downloads', 'cana');
const workDir = join(root, '.tmp-cana-example-downloads');

const downloads = [
  {
    folderName: 'cana-react-context',
    examples: [
      ['simple', 'react-context-basic'],
      ['advanced', 'react-context-advanced']
    ]
  },
  {
    folderName: 'cana-react-redux',
    examples: [
      ['simple', 'react-redux-basic'],
      ['advanced', 'react-redux-advanced']
    ]
  },
  {
    folderName: 'cana-vue-pinia',
    examples: [
      ['simple', 'vue-pinia-basic'],
      ['advanced', 'vue-pinia-advanced']
    ]
  }
];

function assertZipAvailable() {
  const result = spawnSync('/usr/bin/zip', ['--version'], { stdio: 'ignore' });
  if (result.status !== 0) {
    throw new Error('The zip command is required to build Cana example downloads.');
  }
}

function vendorPackageJson(packageName) {
  const packageBase = packageName.replace('@jumentix/', '');
  const exports = packageBase === 'cana-react'
    ? {
        '.': {
          types: './src/index.ts',
          import: './src/index.ts',
          default: './src/index.ts'
        },
        './redux': {
          types: './src/redux.ts',
          import: './src/redux.ts',
          default: './src/redux.ts'
        },
        './package.json': './package.json'
      }
    : {
        '.': {
          types: './src/index.ts',
          import: './src/index.ts',
          default: './src/index.ts'
        },
        './package.json': './package.json'
      };

  return JSON.stringify({
    name: packageName,
    version: '0.1.0-local-docs',
    private: true,
    type: 'module',
    module: './src/index.ts',
    types: './src/index.ts',
    exports
  }, null, 2);
}

function writeVendorPackage(appDir, packageBase, packageName) {
  const sourceDir = join(monorepoRoot, 'packages', packageBase, 'src');
  const targetDir = join(appDir, 'vendor', packageBase);
  cpSync(sourceDir, join(targetDir, 'src'), { recursive: true });
  writeFileSync(join(targetDir, 'package.json'), vendorPackageJson(packageName), 'utf8');
}

function writeVendorPackages(appDir, example) {
  writeVendorPackage(appDir, 'cana', '@jumentix/cana');
  if (example.framework === 'React Context' || example.framework === 'React Redux') {
    writeVendorPackage(appDir, 'cana-react', '@jumentix/cana-react');
  }
  if (example.framework === 'Vue 3 + Pinia') {
    writeVendorPackage(appDir, 'cana-vue', '@jumentix/cana-vue');
  }
}

function packageJsonForDownload(source, example) {
  const packageJson = JSON.parse(source);
  packageJson.dependencies = packageJson.dependencies ?? {};
  packageJson.dependencies['@jumentix/cana'] = 'file:./vendor/cana';
  if (example.framework === 'React Context' || example.framework === 'React Redux') {
    packageJson.dependencies['@jumentix/cana-react'] = 'file:./vendor/cana-react';
  }
  if (example.framework === 'Vue 3 + Pinia') {
    packageJson.dependencies['@jumentix/cana-vue'] = 'file:./vendor/cana-vue';
  }
  return `${JSON.stringify(packageJson, null, 2)}\n`;
}

function writeApp(exampleId, folderName, variantName) {
  const example = CANA_FRAMEWORK_EXAMPLES.find((item) => item.id === exampleId);
  if (!example) throw new Error(`Missing Cana framework example: ${exampleId}`);

  const appDir = join(workDir, folderName, variantName);
  mkdirSync(appDir, { recursive: true });

  for (const file of example.files) {
    const target = join(appDir, file.path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(
      target,
      file.path === 'package.json' ? packageJsonForDownload(file.source, example) : file.source,
      'utf8'
    );
  }

  writeVendorPackages(appDir, example);

  writeFileSync(
    join(appDir, 'README.md'),
    [
      `# ${folderName} ${variantName}`,
      '',
      'This downloadable archive vendors local @jumentix packages so the app can install and build before those packages are published to npm.',
      '',
      'Run the example app:',
      '',
      '```bash',
      'npm install',
      'npm run dev',
      '```',
      '',
      'Build the example app:',
      '',
      '```bash',
      'npm run build',
      '```',
      ''
    ].join('\n'),
    'utf8'
  );
}

function writeDownloadReadme(folderName, examples) {
  writeFileSync(
    join(workDir, folderName, 'README.md'),
    [
      `# ${folderName}`,
      '',
      'This archive contains both runnable variants used by the Cana documentation:',
      '',
      ...examples.map(([variantName]) => `- \`${variantName}/\``),
      '',
      'Run either app:',
      '',
      '```bash',
      'cd simple',
      'npm install',
      'npm run dev',
      '```',
      '',
      'Build either app:',
      '',
      '```bash',
      'cd advanced',
      'npm install',
      'npm run build',
      '```',
      ''
    ].join('\n'),
    'utf8'
  );
}

function zipApp(folderName) {
  const archive = join(outputDir, `${folderName}.zip`);
  rmSync(archive, { force: true });
  const result = spawnSync('/usr/bin/zip', ['-qr', archive, folderName], {
    cwd: workDir,
    encoding: 'utf8'
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `zip failed for ${folderName}`);
  }
  console.log(`[website] generated ${relative(root, archive)}`);
}

assertZipAvailable();
rmSync(workDir, { recursive: true, force: true });
mkdirSync(outputDir, { recursive: true });
mkdirSync(workDir, { recursive: true });

for (const { folderName, examples } of downloads) {
  mkdirSync(join(workDir, folderName), { recursive: true });
  for (const [variantName, exampleId] of examples) {
    writeApp(exampleId, folderName, variantName);
  }
  writeDownloadReadme(folderName, examples);
  zipApp(folderName);
}

if (!existsSync(join(outputDir, 'cana-react-context.zip'))) {
  throw new Error('Cana example downloads were not generated.');
}

rmSync(workDir, { recursive: true, force: true });
