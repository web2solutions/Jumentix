/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const REQUIREMENTS_DIRECTORY = '.agents/requirements';
const REQUIREMENTS_INDEX = '.agents/README.md';
const LEDGER_PATH = 'documentation/md/SPEC-REQUIREMENTS-TRACEABILITY-LEDGER.md';
const INVENTORY_DOCUMENTS = Object.freeze([
  LEDGER_PATH,
  'documentation/md/SPEC-REQUIREMENTS-TRACEABILITY-LEDGER.pt-BR.md',
  'documentation/md/SPEC-REQUIREMENTS-COVERAGE-STATUS.md',
  'documentation/md/SPEC-REQUIREMENTS-COVERAGE-STATUS.pt-BR.md'
]);

function read(rootDir, relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

function collectRequirementInventory(rootDir = process.cwd()) {
  const directory = path.join(rootDir, REQUIREMENTS_DIRECTORY);
  const files = fs.readdirSync(directory)
    .filter((file) => file.endsWith('.md'))
    .sort();
  const invalidFiles = files.filter((file) => !/^\d{3}-[a-z0-9-]+\.md$/.test(file));
  const counts = new Map();

  for (const file of files) {
    const id = file.match(/^(\d{3})-/)?.[1];
    if (id) counts.set(id, (counts.get(id) || 0) + 1);
  }

  const ids = [...counts.keys()].sort();
  const duplicates = [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([id]) => id)
    .sort();

  return { files, ids, duplicates, invalidFiles };
}

function extractIndexedFiles(contents) {
  return [...String(contents || '').matchAll(/\(requirements\/([^)]+\.md)\)/g)]
    .map((match) => match[1]);
}

function extractLedgerIds(contents) {
  const groups = String(contents || '').match(
    /## Requirement Groups([\s\S]*?)## Governance Binding/
  )?.[1] || '';
  return [...new Set([...groups.matchAll(/`(\d{3})`/g)].map((match) => match[1]))].sort();
}

function inventoryMarker(inventory, mappedCount) {
  return [
    '<!-- requirements-inventory:',
    `files=${String(inventory.files.length)}`,
    `unique=${String(inventory.ids.length)}`,
    `mapped=${String(mappedCount)}`,
    `duplicates=${inventory.duplicates.join(',')}`,
    '-->'
  ].join(' ');
}

function validateRequirementsRegistry(rootDir = process.cwd()) {
  const failures = [];
  const inventory = collectRequirementInventory(rootDir);
  const indexedFiles = extractIndexedFiles(read(rootDir, REQUIREMENTS_INDEX));
  const indexCounts = new Map();

  indexedFiles.forEach((file) => indexCounts.set(file, (indexCounts.get(file) || 0) + 1));

  inventory.invalidFiles.forEach((file) => {
    failures.push(`[requirements] invalid requirement filename: ${file}`);
  });
  inventory.files.forEach((file) => {
    const count = indexCounts.get(file) || 0;
    if (count !== 1) {
      failures.push(`[requirements] index must link ${file} exactly once; found ${String(count)}`);
    }
  });
  indexedFiles
    .filter((file) => !inventory.files.includes(file))
    .forEach((file) => failures.push(`[requirements] stale index link: ${file}`));

  const ledgerIds = extractLedgerIds(read(rootDir, LEDGER_PATH));
  const missingLedgerIds = inventory.ids.filter((id) => !ledgerIds.includes(id));
  const staleLedgerIds = ledgerIds.filter((id) => !inventory.ids.includes(id));
  if (missingLedgerIds.length > 0) {
    failures.push(`[requirements] ledger missing IDs: ${missingLedgerIds.join(', ')}`);
  }
  if (staleLedgerIds.length > 0) {
    failures.push(`[requirements] ledger contains stale IDs: ${staleLedgerIds.join(', ')}`);
  }

  const expectedMarker = inventoryMarker(inventory, ledgerIds.length);
  INVENTORY_DOCUMENTS.forEach((documentPath) => {
    const contents = read(rootDir, documentPath);
    if (!contents.includes(expectedMarker)) {
      failures.push(`[requirements] stale inventory marker: ${documentPath}`);
    }
  });

  return failures;
}

function run(rootDir = process.cwd()) {
  const failures = validateRequirementsRegistry(rootDir);
  if (failures.length > 0) {
    failures.forEach((failure) => console.error(failure));
    return 1;
  }

  const inventory = collectRequirementInventory(rootDir);
  console.log(
    `Requirements registry is consistent: ${String(inventory.files.length)} files, `
    + `${String(inventory.ids.length)} unique IDs, duplicates ${inventory.duplicates.join(', ')}.`
  );
  return 0;
}

if (require.main === module) {
  process.exitCode = run();
}

module.exports = {
  INVENTORY_DOCUMENTS,
  LEDGER_PATH,
  REQUIREMENTS_DIRECTORY,
  REQUIREMENTS_INDEX,
  collectRequirementInventory,
  extractIndexedFiles,
  extractLedgerIds,
  inventoryMarker,
  run,
  validateRequirementsRegistry
};
