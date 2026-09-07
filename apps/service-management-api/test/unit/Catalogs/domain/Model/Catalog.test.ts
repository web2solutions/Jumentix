/* eslint-disable jest/max-expects */
import { Catalog } from '@service-management-api/modules/Catalogs/domain/Model/Catalog';

/**
 * Unit suite for the shared-catalog aggregate (JUM-491). The model owns the
 * concurrency token and the tombstone semantics, so these are pinned here:
 * version starts at 1, every mutation bumps it, a soft delete keeps the
 * record (propagatable, recoverable), and `serialize()` never leaks the
 * mutation methods or the derived `deleted` flag into the stored document.
 */
describe('catalog domain model', () => {
  it('creates an active record with version 1 and an empty tombstone', () => {
    expect.hasAssertions();
    const catalog = new Catalog({
      organization: 'org-1',
      name: 'Billing',
      design: { entities: [{ name: 'Invoice' }] }
    });
    expect(catalog.version).toBe(1);
    expect(catalog.deletedAt).toBe('');
    expect(catalog.deleted).toBe(false);
    expect(catalog.organization).toBe('org-1');
    expect(catalog.id).toBeTruthy();
  });

  it('rejects an empty name', () => {
    expect.hasAssertions();
    expect(() => new Catalog({ organization: 'org-1', name: '', design: {} }))
      .toThrow('name can not be empty');
  });

  it('rejects an empty organization', () => {
    expect.hasAssertions();
    expect(() => new Catalog({ organization: '', name: 'Billing', design: {} }))
      .toThrow('organization can not be empty');
  });

  it('bumpVersion increments the token and stamps the actor', () => {
    expect.hasAssertions();
    const catalog = new Catalog({ organization: 'org-1', name: 'Billing', design: {} });
    catalog.bumpVersion('user@xpertminds.dev');
    expect(catalog.version).toBe(2);
    expect(catalog.updatedBy).toBe('user@xpertminds.dev');
  });

  it('tombstone soft-deletes: record stays, deletedAt set, version bumped', () => {
    expect.hasAssertions();
    const catalog = new Catalog({ organization: 'org-1', name: 'Billing', design: {} });
    catalog.tombstone('admin@xpertminds.dev');
    expect(catalog.deleted).toBe(true);
    expect(catalog.deletedAt).not.toBe('');
    expect(catalog.version).toBe(2);
    expect(catalog.updatedBy).toBe('admin@xpertminds.dev');
  });

  it('restore clears the tombstone and bumps the version again', () => {
    expect.hasAssertions();
    const catalog = new Catalog({ organization: 'org-1', name: 'Billing', design: {} });
    catalog.tombstone('admin@xpertminds.dev');
    catalog.restore('admin@xpertminds.dev');
    expect(catalog.deleted).toBe(false);
    expect(catalog.deletedAt).toBe('');
    expect(catalog.version).toBe(3);
  });

  it('mutates through its setters like the repository update path does', () => {
    expect.hasAssertions();
    const catalog = new Catalog({ organization: 'org-1', name: 'Billing', design: {} });
    catalog.name = 'Billing v2';
    catalog.description = 'shared billing domain';
    catalog.design = { entities: [{ name: 'Invoice' }] };
    catalog.provenance = { package: 'billing', version: '2.0.0' };
    catalog.updatedBy = 'user@xpertminds.dev';
    expect(catalog.name).toBe('Billing v2');
    expect(catalog.description).toBe('shared billing domain');
    expect(catalog.design).toStrictEqual({ entities: [{ name: 'Invoice' }] });
    expect(catalog.provenance).toStrictEqual({ package: 'billing', version: '2.0.0' });
    expect(catalog.updatedBy).toBe('user@xpertminds.dev');
    expect(catalog.createdBy).toBe('');
  });

  it('normalizes undefined mutations to the empty defaults', () => {
    expect.hasAssertions();
    const catalog = new Catalog({ organization: 'org-1', name: 'Billing', design: {} });
    catalog.description = undefined as any;
    catalog.design = undefined as any;
    catalog.updatedBy = undefined as any;
    expect(catalog.description).toBe('');
    expect(catalog.design).toStrictEqual({});
    expect(catalog.updatedBy).toBe('');
  });

  it('rejects renaming to an empty name', () => {
    expect.hasAssertions();
    const catalog = new Catalog({ organization: 'org-1', name: 'Billing', design: {} });
    expect(() => { catalog.name = ''; }).toThrow('name can not be empty');
  });

  it('serialize carries the concurrency metadata and no methods', () => {
    expect.hasAssertions();
    const catalog = new Catalog({
      organization: 'org-1',
      name: 'Billing',
      description: 'Billing domain',
      design: { entities: [] },
      provenance: { package: 'billing', version: '1.0.0' },
      createdBy: 'user@xpertminds.dev'
    });
    const serialized = catalog.serialize() as Record<string, any>;
    expect(serialized.version).toBe(1);
    expect(serialized.deletedAt).toBe('');
    expect(serialized.organization).toBe('org-1');
    expect(serialized.provenance).toStrictEqual({ package: 'billing', version: '1.0.0' });
    expect(serialized.deleted).toBeUndefined();
    expect(serialized.bumpVersion).toBeUndefined();
    expect(serialized.tombstone).toBeUndefined();
    expect(serialized.restore).toBeUndefined();
  });
});
