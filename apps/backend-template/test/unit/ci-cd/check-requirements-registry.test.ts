/* eslint-disable @typescript-eslint/no-var-requires */
const registryFs = require('fs');
const registryOs = require('os');
const registryPath = require('path');
const {
  INVENTORY_DOCUMENTS,
  collectRequirementInventory,
  inventoryMarker,
  validateRequirementsRegistry
} = require('../../../../../ci-cd/check-requirements-registry');

describe('check-requirements-registry', () => {
  it('keeps the live requirement index, ledger, and bilingual inventory synchronized', () => {
    expect.hasAssertions();
    const inventory = collectRequirementInventory();

    expect(Array.isArray(inventory.files)).toBe(true);
    expect(Array.isArray(inventory.ids)).toBe(true);
    expect(inventory.duplicates).toStrictEqual(['055', '060', '079']);
    expect(inventory.invalidFiles).toStrictEqual([]);
    expect(validateRequirementsRegistry()).toStrictEqual([]);
  });

  it('fails closed for missing index links, ledger IDs, and stale inventory markers', () => {
    expect.hasAssertions();
    const rootDir = registryFs.mkdtempSync(registryPath.join(registryOs.tmpdir(), 'requirements-'));
    const requirementsDir = registryPath.join(rootDir, '.agents/requirements');
    registryFs.mkdirSync(requirementsDir, { recursive: true });
    registryFs.writeFileSync(registryPath.join(requirementsDir, '001-first.md'), '# 001\n');
    registryFs.writeFileSync(registryPath.join(requirementsDir, '002-second.md'), '# 002\n');
    registryFs.writeFileSync(registryPath.join(requirementsDir, '002-third.md'), '# 002 duplicate\n');
    registryFs.writeFileSync(
      registryPath.join(rootDir, '.agents/README.md'),
      '- [001-first](requirements/001-first.md)\n'
    );

    const staleMarker = '<!-- requirements-inventory: files=1 unique=1 mapped=1 duplicates= -->';
    const [ledgerDocument, ...inventoryDocuments] = INVENTORY_DOCUMENTS;
    const ledgerAbsolutePath = registryPath.join(rootDir, ledgerDocument);
    registryFs.mkdirSync(registryPath.dirname(ledgerAbsolutePath), { recursive: true });
    registryFs.writeFileSync(
      ledgerAbsolutePath,
      `${staleMarker}\n## Requirement Groups\n- \`001\`\n## Governance Binding\n`
    );
    for (const documentPath of inventoryDocuments) {
      const absolutePath = registryPath.join(rootDir, documentPath);
      registryFs.mkdirSync(registryPath.dirname(absolutePath), { recursive: true });
      registryFs.writeFileSync(absolutePath, `${staleMarker}\n`);
    }

    const failures = validateRequirementsRegistry(rootDir);
    expect(failures).toStrictEqual(expect.arrayContaining([
      expect.stringContaining('002-second.md exactly once'),
      expect.stringContaining('002-third.md exactly once'),
      expect.stringContaining('ledger missing IDs: 002'),
      expect.stringContaining('stale inventory marker')
    ]));
    expect(inventoryMarker(collectRequirementInventory(rootDir), 1))
      .toContain('files=3 unique=2 mapped=1 duplicates=002');
    registryFs.rmSync(rootDir, { recursive: true, force: true });
  });
});
