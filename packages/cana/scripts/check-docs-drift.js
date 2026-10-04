/* eslint-disable no-console -- CLI drift check: stdout/stderr is its report channel. */
/**
 * Fail-closed drift check: website content-sources for Cana consumer guides
 * must point at packages/cana/docs (EN + pt-BR), and every listed source file
 * must exist. Ownership: packages/cana (Requirement 137).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(scriptDir, '..');
const monorepoRoot = path.resolve(packageRoot, '../..');
const websiteRoot = path.join(monorepoRoot, 'apps/jumentix-website');
const sourcesPath = path.join(websiteRoot, 'config/content-sources.json');

const REQUIRED_DOCS = [
  'usage-guide',
  'getting-started',
  'schema-keys',
  'crud-bulk',
  'querying',
  'transactions-events',
  'hooks-errors',
  'storage-recovery',
  'workers-testing',
  'api-reference',
  'any-framework',
  'vanilla-typescript'
];

const REQUIRED_USAGE_SOURCES = [
  'usage-guide',
  'getting-started',
  'schema-keys',
  'crud-bulk',
  'querying',
  'transactions-events',
  'hooks-errors',
  'storage-recovery',
  'workers-testing',
  'api-reference'
];

const errors = [];

const config = JSON.parse(fs.readFileSync(sourcesPath, 'utf8'));
const canaEntries = config.entries.filter((entry) =>
  String(entry.section || '').startsWith('packages/cana')
);

const usageShortNames = new Set();

for (const entry of canaEntries) {
  for (const key of ['source', 'sourcePtBr']) {
    const rel = entry[key];
    if (!rel) {
      errors.push(`${entry.section}/${entry.slug} missing ${key}`);
      continue;
    }
    const absolute = path.resolve(websiteRoot, rel);
    if (!fs.existsSync(absolute)) {
      errors.push(`missing file for ${entry.section}/${entry.slug} ${key}: ${rel}`);
      continue;
    }
    const normalized = rel.replace(/\\/g, '/');
    if (
      entry.section === 'packages/cana/usage' ||
      ['any-framework', 'vanilla-typescript'].includes(entry.slug)
    ) {
      if (!normalized.includes('/packages/cana/docs/')) {
        errors.push(
          `${entry.section}/${entry.slug} ${key} must live under packages/cana/docs (got ${rel})`
        );
      }
    }
    if (entry.section === 'packages/cana/usage' && key === 'source') {
      usageShortNames.add(path.basename(absolute, '.md'));
    }
  }
}

for (const locale of ['en', 'pt-BR']) {
  for (const name of REQUIRED_DOCS) {
    const docPath = path.join(packageRoot, 'docs', locale, `${name}.md`);
    if (!fs.existsSync(docPath)) {
      errors.push(`missing package doc ${locale}/${name}.md`);
    }
  }
}

for (const name of REQUIRED_USAGE_SOURCES) {
  if (!usageShortNames.has(name)) {
    errors.push(`content-sources missing packages/cana/usage entry for ${name}.md`);
  }
}

const hasAny = canaEntries.some((entry) => entry.slug === 'any-framework');
const hasVanilla = canaEntries.some((entry) => entry.slug === 'vanilla-typescript');
if (!hasAny) errors.push('content-sources missing packages/cana any-framework');
if (!hasVanilla) errors.push('content-sources missing packages/cana vanilla-typescript');

if (errors.length > 0) {
  console.error('cana docs drift check failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
}

console.log(
  `cana docs drift check passed (${REQUIRED_DOCS.length} docs × 2 locales; ${canaEntries.length} content-sources entries)`
);
