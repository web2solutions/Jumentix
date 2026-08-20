import { deleteCatalogById } from '@src/modules/Catalogs/features/deleteCatalogById';
import { restoreCatalog } from '@src/modules/Catalogs/features/restoreCatalog';
import { updateCatalog } from '@src/modules/Catalogs/features/updateCatalog';
import type { ICatalogRepository } from '@src/modules/Catalogs/service/ports/ICatalogRepository';

describe('catalog feature defaults', () => {
  it('passes an empty actor to delete when no actor is provided', async () => {
    expect.hasAssertions();
    const repository = {
      delete: jest.fn().mockResolvedValue(true)
    } as unknown as ICatalogRepository;

    await expect(deleteCatalogById('catalog-1', 4, repository)).resolves.toBe(true);

    expect(repository.delete).toHaveBeenCalledWith('catalog-1', 4, '');
  });

  it('passes an empty actor to update when no actor is provided', async () => {
    expect.hasAssertions();
    const serialized = { id: 'catalog-1', name: 'Tasks', version: 5 };
    const repository = {
      update: jest.fn().mockResolvedValue({
        serialize: () => serialized
      })
    } as unknown as ICatalogRepository;

    await expect(updateCatalog('catalog-1', { name: 'Tasks', version: 4 }, repository))
      .resolves
      .toBe(serialized);

    expect(repository.update).toHaveBeenCalledWith('catalog-1', { name: 'Tasks', version: 4 }, '');
  });

  it('passes an empty actor to restore when no actor is provided', async () => {
    expect.hasAssertions();
    const serialized = { id: 'catalog-1', name: 'Tasks', version: 6 };
    const repository = {
      restore: jest.fn().mockResolvedValue({
        serialize: () => serialized
      })
    } as unknown as ICatalogRepository;

    await expect(restoreCatalog('catalog-1', 5, repository))
      .resolves
      .toBe(serialized);

    expect(repository.restore).toHaveBeenCalledWith('catalog-1', 5, '');
  });
});
