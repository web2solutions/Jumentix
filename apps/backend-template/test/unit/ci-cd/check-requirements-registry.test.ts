/* eslint-disable @typescript-eslint/no-var-requires */
const registryFs = require('fs');
const registryOs = require('os');
const registryPath = require('path');
const {
  INVENTORY_DOCUMENTS,
  collectRequirementInventory,
  extractNfrRegistryIds,
  inventoryMarker,
  validateRequirementsRegistry
} = require('../../../../../ci-cd/check-requirements-registry');

function coverageFixture(documentPath: string, marker: string): string {
  if (documentPath.endsWith('.pt-BR.md')) {
    return [
      marker,
      '## Cobertura de requisitos não funcionais',
      'IDs NFR cobertos (`1`):',
      '`002`',
      '## Cobertura de Requisitos Funcionais',
      'IDs funcionais cobertos (`1`):',
      '`001`',
      '## Regra de vinculação'
    ].join('\n');
  }

  return [
    marker,
    '## Non-Functional Requirements Coverage',
    'NFR IDs covered (`1`):',
    '`002`',
    '## Functional Requirements Coverage',
    'Functional IDs covered (`1`):',
    '`001`',
    '## Binding Rule'
  ].join('\n');
}

describe('check-requirements-registry', () => {
  it('extracts only explicit NFR entry prefixes, including combined entries', () => {
    expect.hasAssertions();
    expect(extractNfrRegistryIds([
      '- `096` Bun migration supersedes `001`, `012`, and `048`.',
      '- `056`/`064` Superseded project tracking requirements.'
    ].join('\n'))).toStrictEqual(['056', '064', '096']);
  });

  it('keeps the live requirement index, ledger, and bilingual inventory synchronized', () => {
    expect.hasAssertions();
    const inventory = collectRequirementInventory();

    expect(Array.isArray(inventory.files)).toBe(true);
    expect(Array.isArray(inventory.ids)).toBe(true);
    expect(inventory.duplicates).toStrictEqual([]);
    expect(inventory.invalidFiles).toStrictEqual([]);
    expect(validateRequirementsRegistry()).toStrictEqual([]);
  });

  /**
   * JUM-609 — a duplicate ID fails for being a duplicate.
   *
   * It used to be counted, embedded in the inventory marker, printed in the
   * success line, and never fail anything. The refusal came only as a side
   * effect: the marker stopped matching the documents and the gate reported
   * `stale inventory marker` in four files, never once saying two requirements
   * share a number. Every instruction that message gives leads towards making
   * the documents agree with the duplicate.
   *
   * 055, 060 and 079 are in this repository's history for that reason.
   */
  it('names the duplicate ID and both files that claim it', () => {
    expect.hasAssertions();

    const rootDir = registryFs.mkdtempSync(registryPath.join(registryOs.tmpdir(), 'requirements-dup-'));
    const requirementsDir = registryPath.join(rootDir, '.agents/requirements');
    registryFs.mkdirSync(registryPath.join(requirementsDir, 'project'), { recursive: true });
    registryFs.mkdirSync(registryPath.join(requirementsDir, 'software'), { recursive: true });
    registryFs.writeFileSync(registryPath.join(requirementsDir, 'project/055-original.md'), '# 055\n');
    registryFs.writeFileSync(registryPath.join(requirementsDir, 'software/055-renumbered.md'), '# 055\n');

    registryFs.writeFileSync(
      registryPath.join(rootDir, '.agents/README.md'),
      '- [055-original](requirements/project/055-original.md)\n'
        + '- [055-renumbered](requirements/software/055-renumbered.md)\n'
    );
    registryFs.writeFileSync(
      registryPath.join(rootDir, '.agents/NFR-REGISTRY.md'),
      '- `055` mapped\n'
    );
    const marker = '<!-- requirements-inventory: files=2 unique=1 mapped=1 duplicates=055 -->';
    const [ledgerDocument, ...inventoryDocuments] = INVENTORY_DOCUMENTS;
    const ledgerAbsolutePath = registryPath.join(rootDir, ledgerDocument);
    registryFs.mkdirSync(registryPath.dirname(ledgerAbsolutePath), { recursive: true });
    registryFs.writeFileSync(
      ledgerAbsolutePath,
      `${marker}\n## Requirement Groups\n- \`055\`\n## Governance Binding\n`
    );
    for (const documentPath of inventoryDocuments) {
      const absolutePath = registryPath.join(rootDir, documentPath);
      registryFs.mkdirSync(registryPath.dirname(absolutePath), { recursive: true });
      registryFs.writeFileSync(absolutePath, `${coverageFixture(documentPath, marker)}\n`);
    }

    const inventory = collectRequirementInventory(rootDir);

    expect(inventory.duplicates).toStrictEqual(['055']);
    expect(inventory.duplicateFiles['055']).toStrictEqual([
      'project/055-original.md',
      'software/055-renumbered.md'
    ]);
    // Across the two namespaces, which is where the collisions this issue was
    // filed for actually came from.
    expect(validateRequirementsRegistry(rootDir)).toStrictEqual(expect.arrayContaining([
      '[requirements] duplicate requirement ID 055 used by 2 files: '
        + 'project/055-original.md, software/055-renumbered.md'
    ]));

    registryFs.rmSync(rootDir, { recursive: true, force: true });
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
    registryFs.writeFileSync(
      registryPath.join(rootDir, '.agents/NFR-REGISTRY.md'),
      '- `001` mapped NFR with an incidental `002` cross-reference\n'
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
      const coverageContents = coverageFixture(documentPath, staleMarker);
      registryFs.writeFileSync(absolutePath, `${coverageContents}\n`);
    }

    const failures = validateRequirementsRegistry(rootDir);
    expect(failures).toStrictEqual(expect.arrayContaining([
      expect.stringContaining('002-second.md exactly once'),
      expect.stringContaining('002-third.md exactly once'),
      expect.stringContaining('ledger missing IDs: 002'),
      expect.stringContaining('NFR registry missing IDs: 002'),
      expect.stringContaining('stale inventory marker'),
      // JUM-609: the fixture has carried a duplicate 002 all along, and nothing
      // asserted on it because nothing failed for it.
      expect.stringContaining(
        'duplicate requirement ID 002 used by 2 files: 002-second.md, 002-third.md'
      )
    ]));
    expect(inventoryMarker(collectRequirementInventory(rootDir), 1))
      .toContain('files=3 unique=2 mapped=1 duplicates=002');
    registryFs.rmSync(rootDir, { recursive: true, force: true });
  });
});
