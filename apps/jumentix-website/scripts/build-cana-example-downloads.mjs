#!/usr/bin/env bun
/* eslint-disable no-console */
import {
  existsSync,
  mkdirSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { spawnSync } from 'node:child_process';
import { CANA_FRAMEWORK_EXAMPLES } from '../components/cana-framework/catalog.ts';

const root = process.cwd();
const outputDir = join(root, 'public', 'downloads', 'cana');
const workDir = join(root, '.tmp-cana-example-downloads');

const downloads = [
  ['react-context-advanced', 'cana-react-context'],
  ['react-redux-advanced', 'cana-react-redux'],
  ['vue-pinia-advanced', 'cana-vue-pinia']
];

function assertZipAvailable() {
  const result = spawnSync('/usr/bin/zip', ['--version'], { stdio: 'ignore' });
  if (result.status !== 0) {
    throw new Error('The zip command is required to build Cana example downloads.');
  }
}

function writeApp(exampleId, folderName) {
  const example = CANA_FRAMEWORK_EXAMPLES.find((item) => item.id === exampleId);
  if (!example) throw new Error(`Missing Cana framework example: ${exampleId}`);

  const appDir = join(workDir, folderName);
  mkdirSync(appDir, { recursive: true });

  for (const file of example.files) {
    const target = join(appDir, file.path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, file.source, 'utf8');
  }

  writeFileSync(
    join(appDir, 'README.md'),
    [
      `# ${folderName}`,
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

for (const [exampleId, folderName] of downloads) {
  writeApp(exampleId, folderName);
  zipApp(folderName);
}

if (!existsSync(join(outputDir, 'cana-react-context.zip'))) {
  throw new Error('Cana example downloads were not generated.');
}

rmSync(workDir, { recursive: true, force: true });
