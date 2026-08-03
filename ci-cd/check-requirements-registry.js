/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const REQUIREMENTS_DIRECTORY = '.agents/requirements';
const REQUIREMENTS_INDEX = '.agents/README.md';
const NFR_REGISTRY_PATH = '.agents/NFR-REGISTRY.md';
const LEDGER_PATH = 'documentation/md/SPEC-REQUIREMENTS-TRACEABILITY-LEDGER.md';
const COVERAGE_DOCUMENTS = Object.freeze([
  'documentation/md/SPEC-REQUIREMENTS-COVERAGE-STATUS.md',
  'documentation/md/SPEC-REQUIREMENTS-COVERAGE-STATUS.pt-BR.md'
]);
const INVENTORY_DOCUMENTS = Object.freeze([
  LEDGER_PATH,
  'documentation/md/SPEC-REQUIREMENTS-TRACEABILITY-LEDGER.pt-BR.md',
  ...COVERAGE_DOCUMENTS
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

function extractBacktickedIds(contents) {
  return [...new Set(
    [...String(contents || '').matchAll(/`(\d{3})`/g)].map((match) => match[1])
  )].sort();
}

function extractNfrRegistryIds(contents) {
  const ids = [];
  String(contents || '').split('\n').forEach((line) => {
    const entryPrefix = line.match(/^- ((?:`\d{3}`\/?)+)(?:\s|$)/)?.[1] || '';
    ids.push(...extractBacktickedIds(entryPrefix));
  });
  return [...new Set(ids)].sort();
}

function extractCoverageClassification(contents) {
  const source = String(contents || '');
  const nfrBlock = source.match(
    /## (?:Non-Functional Requirements Coverage|Cobertura de requisitos não funcionais)([\s\S]*?)## (?:Functional Requirements Coverage|Cobertura de Requisitos Funcionais)/i
  )?.[1] || '';
  const functionalBlock = source.match(
    /## (?:Functional Requirements Coverage|Cobertura de Requisitos Funcionais)([\s\S]*?)## (?:Binding Rule|Regra de vinculação)/i
  )?.[1] || '';

  return {
    nfrIds: extractBacktickedIds(nfrBlock),
    functionalIds: extractBacktickedIds(functionalBlock),
    declaredNfrCount: Number(nfrBlock.match(/\(`(\d+)`\)/)?.[1] || -1),
    declaredFunctionalCount: Number(functionalBlock.match(/\(`(\d+)`\)/)?.[1] || -1)
  };
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
  inventory.duplicates.forEach((id) => {
    const conflicting = inventory.files.filter((file) => file.startsWith(`${id}-`));
    failures.push(
      `[requirements] duplicate requirement ID ${id}: ${conflicting.join(', ')}`
    );
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

  const nfrRegistryIds = extractNfrRegistryIds(read(rootDir, NFR_REGISTRY_PATH));
  let canonicalClassification;
  COVERAGE_DOCUMENTS.forEach((documentPath) => {
    const classification = extractCoverageClassification(read(rootDir, documentPath));
    const classifiedIds = [...new Set([
      ...classification.nfrIds,
      ...classification.functionalIds
    ])].sort();
    const overlappingIds = classification.nfrIds.filter(
      (id) => classification.functionalIds.includes(id)
    );
    const missingClassifications = inventory.ids.filter((id) => !classifiedIds.includes(id));
    const staleClassifications = classifiedIds.filter((id) => !inventory.ids.includes(id));

    if (classification.declaredNfrCount !== classification.nfrIds.length) {
      failures.push(
        `[requirements] NFR count mismatch in ${documentPath}: declared `
        + `${String(classification.declaredNfrCount)}, found ${String(classification.nfrIds.length)}`
      );
    }
    if (classification.declaredFunctionalCount !== classification.functionalIds.length) {
      failures.push(
        `[requirements] functional count mismatch in ${documentPath}: declared `
        + `${String(classification.declaredFunctionalCount)}, `
        + `found ${String(classification.functionalIds.length)}`
      );
    }
    if (missingClassifications.length > 0) {
      failures.push(
        `[requirements] coverage classification missing IDs in ${documentPath}: `
        + missingClassifications.join(', ')
      );
    }
    if (staleClassifications.length > 0) {
      failures.push(
        `[requirements] coverage classification contains stale IDs in ${documentPath}: `
        + staleClassifications.join(', ')
      );
    }
    if (overlappingIds.length > 0) {
      failures.push(
        `[requirements] coverage classification overlaps in ${documentPath}: `
        + overlappingIds.join(', ')
      );
    }

    if (!canonicalClassification) {
      canonicalClassification = classification;
    } else if (
      canonicalClassification.nfrIds.join(',') !== classification.nfrIds.join(',')
      || canonicalClassification.functionalIds.join(',')
        !== classification.functionalIds.join(',')
    ) {
      failures.push(`[requirements] bilingual coverage classification drift: ${documentPath}`);
    }
  });

  const missingNfrMappings = (canonicalClassification?.nfrIds || [])
    .filter((id) => !nfrRegistryIds.includes(id));
  if (missingNfrMappings.length > 0) {
    failures.push(`[requirements] NFR registry missing IDs: ${missingNfrMappings.join(', ')}`);
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
    + `${String(inventory.ids.length)} unique IDs, duplicates `
    + `${inventory.duplicates.join(', ') || 'none'}.`
  );
  return 0;
}

if (require.main === module) {
  process.exitCode = run();
}

module.exports = {
  COVERAGE_DOCUMENTS,
  INVENTORY_DOCUMENTS,
  LEDGER_PATH,
  NFR_REGISTRY_PATH,
  REQUIREMENTS_DIRECTORY,
  REQUIREMENTS_INDEX,
  collectRequirementInventory,
  extractCoverageClassification,
  extractIndexedFiles,
  extractLedgerIds,
  extractNfrRegistryIds,
  inventoryMarker,
  run,
  validateRequirementsRegistry
};
