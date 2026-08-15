import { Catalog } from '@src/modules/Catalogs/domain/Model/Catalog';

/**
 * The catalog aggregate constructed and mutated directly (JUM-681/JUM-491).
 *
 * Every other suite reaches this model through the repository, which fills in
 * `version`, `design`, `createdBy` and an actor on every call. The HTTP layer
 * and the sync client do not: a create carries a name and a design, a restore
 * carries no actor when the token has no subject, and a record read back from a
 * store written by an older version carries no `provenance` at all.
 *
 * Each fallback here decides something the caller cannot see afterwards. A
 * `version` that defaults to `undefined` rather than 1 makes the first
 * optimistic-concurrency check compare against nothing; a `tombstone` that does
 * not bump the version lets the delete be overwritten by a writer holding the
 * pre-delete version.
 */
describe('catalog model defaults (JUM-681)', () => {
  it('fills in every optional field on a minimal payload', () => {
    expect.hasAssertions();

    const catalog = new Catalog({ name: 'Billing', organization: 'org-1' } as never);

    // Read as one shape: the concurrency token starts at 1 and every optional
    // field is its empty value rather than `undefined`, which is what a store
    // would otherwise persist and a later read would compare against.
    expect({
      version: catalog.version,
      description: catalog.description,
      design: catalog.design,
      provenance: catalog.provenance,
      createdBy: catalog.createdBy,
      updatedBy: catalog.updatedBy,
      deletedAt: catalog.deletedAt
    }).toStrictEqual({
      version: 1,
      description: '',
      design: {},
      provenance: undefined,
      createdBy: '',
      updatedBy: '',
      deletedAt: ''
    });
  });

  it('keeps every field a full payload declares', () => {
    expect.hasAssertions();

    const catalog = new Catalog({
      name: 'Billing',
      organization: 'org-1',
      description: 'invoices',
      version: 7,
      design: { kind: 'domain-package' },
      provenance: { author: 'a' },
      createdBy: 'creator',
      updatedBy: 'editor'
    } as never);

    expect({
      version: catalog.version,
      design: catalog.design,
      provenance: catalog.provenance,
      createdBy: catalog.createdBy
    }).toStrictEqual({
      version: 7,
      design: { kind: 'domain-package' },
      provenance: { author: 'a' },
      createdBy: 'creator'
    });
  });

  it('refuses a payload with no name and one with no organization', () => {
    expect.hasAssertions();

    expect(() => new Catalog({ name: '', organization: 'org-1' } as never))
      .toThrow('name can not be empty');
    expect(() => new Catalog({ name: 'Billing', organization: '' } as never))
      .toThrow('organization can not be empty');
  });

  it('bumps the version with no actor, and with one', () => {
    expect.hasAssertions();

    const anonymous = new Catalog({ name: 'Billing', organization: 'org-1' } as never);
    const attributed = new Catalog({ name: 'Billing', organization: 'org-1' } as never);

    anonymous.bumpVersion();
    attributed.bumpVersion('editor');

    expect(anonymous.version).toBe(2);
    expect(anonymous.updatedBy).toBe('');
    expect(attributed.updatedBy).toBe('editor');
  });

  it('tombstones and restores, bumping the version each time', () => {
    expect.hasAssertions();

    // A restore is a write: leaving the version alone would let a client
    // holding the pre-delete version overwrite the record it just recovered.
    const catalog = new Catalog({ name: 'Billing', organization: 'org-1' } as never);

    catalog.tombstone();
    const afterDelete = { version: catalog.version, deletedAt: catalog.deletedAt };
    catalog.restore();

    expect(afterDelete.version).toBe(2);
    expect(afterDelete.deletedAt).not.toBe('');
    expect(catalog.version).toBe(3);
    expect(catalog.deletedAt).toBe('');
  });

  it('records the actor on a tombstone and on a restore', () => {
    expect.hasAssertions();

    const catalog = new Catalog({ name: 'Billing', organization: 'org-1' } as never);

    catalog.tombstone('remover');
    const removedBy = catalog.updatedBy;
    catalog.restore('recoverer');

    expect(removedBy).toBe('remover');
    expect(catalog.updatedBy).toBe('recoverer');
  });

  it('serialises everything a store needs to rebuild it', () => {
    expect.hasAssertions();

    const catalog = new Catalog({ name: 'Billing', organization: 'org-1' } as never);
    const rebuilt = new Catalog(catalog.serialize() as never);

    expect(rebuilt.id).toBe(catalog.id);
    expect(rebuilt.version).toBe(catalog.version);
    expect(rebuilt.name).toBe('Billing');
  });
});
