/* eslint-disable jest/max-expects */
import { OrganizationService } from '@src/modules/Users/service/OrganizationService';
import { Organization } from '@src/modules/Users/domain/Model/Organization';

const domainOrganization = (name = 'Org') => new Organization({
  id: '4fae5b16-261f-4de7-9cff-1429d5614e44',
  name,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z'
});

const setup = () => {
  const dataRepository = {
    create: jest.fn().mockResolvedValue({ id: 'o1', name: 'Org' }),
    update: jest.fn().mockResolvedValue({ id: 'o1', name: 'Org Updated' }),
    delete: jest.fn().mockResolvedValue(true),
    getOneById: jest.fn().mockResolvedValue({ id: 'o1', name: 'Org' }),
    getAll: jest.fn().mockResolvedValue({
      page: 1,
      size: 10,
      total: 1,
      result: [{ id: 'o1', name: 'Org' }]
    }),
    createAddress: jest.fn().mockResolvedValue({ id: 'o1', name: 'Org' }),
    updateAddress: jest.fn().mockResolvedValue({ id: 'o1', name: 'Org' }),
    deleteAddress: jest.fn().mockResolvedValue({ id: 'o1', name: 'Org' }),
    createPhone: jest.fn().mockResolvedValue({ id: 'o1', name: 'Org' }),
    updatePhone: jest.fn().mockResolvedValue({ id: 'o1', name: 'Org' }),
    deletePhone: jest.fn().mockResolvedValue({ id: 'o1', name: 'Org' }),
    createEmail: jest.fn().mockResolvedValue({ id: 'o1', name: 'Org' }),
    updateEmail: jest.fn().mockResolvedValue({ id: 'o1', name: 'Org' }),
    deleteEmail: jest.fn().mockResolvedValue({ id: 'o1', name: 'Org' })
  };
  const service = OrganizationService.compile({ dataRepository } as any);
  return { service, dataRepository };
};

describe('organization service', () => {
  it('delegates CRUD operations to repository', async () => {
    expect.hasAssertions();
    const { service } = setup();
    expect((await service.create({ name: 'Org' } as any)).result?.id).toBe('o1');
    expect((await service.update('o1', { id: 'o1', name: 'Org Updated' } as any)).result?.name).toBe('Org Updated');
    expect((await service.getOneById('o1')).result?.id).toBe('o1');
  });

  it('delegates paging and deletion operations', async () => {
    expect.hasAssertions();
    const { service, dataRepository } = setup();
    await service.create({ name: 'Org' } as any);
    expect((await service.getAll({}, { page: 1, size: 10 })).result?.[0].id).toBe('o1');
    expect((await service.delete('o1')).result).toBe(true);
    expect(dataRepository.create).toHaveBeenCalledWith({ name: 'Org' });
  });

  it('serializes domain models before exposing or caching service responses', async () => {
    expect.hasAssertions();
    const organization = domainOrganization();
    const dataRepository = {
      create: jest.fn().mockResolvedValue(organization),
      getOneById: jest.fn().mockResolvedValue(organization),
      getAll: jest.fn().mockResolvedValue({
        page: 1,
        size: 10,
        total: 1,
        result: [organization]
      })
    };
    const cacheService = {
      get: jest.fn().mockResolvedValue(undefined),
      set: jest.fn().mockResolvedValue(undefined),
      getVersion: jest.fn().mockResolvedValue(1),
      bumpVersion: jest.fn().mockResolvedValue(2)
    };
    const service = OrganizationService.compile({
      dataRepository,
      services: { cacheService }
    } as any);

    const created = (await service.create({ name: 'Org' } as any)).result;
    expect(created).toMatchObject({
      id: organization.id,
      name: 'Org',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z')
    });
    expect(created).not.toHaveProperty('_id');
    expect(created).not.toHaveProperty('_name');
    expect(created).not.toHaveProperty('_excludeOnSerialize');

    const one = (await service.getOneById(organization.id)).result;
    expect(one).toStrictEqual(organization.serialize());
    expect(cacheService.set).toHaveBeenCalledWith(
      `organizations:v1:getOneById:${organization.id}`,
      organization.serialize()
    );

    const all = await service.getAll({}, { page: 1, size: 10 });
    expect(all.result?.[0]).toStrictEqual(organization.serialize());
    expect(all.result?.[0]).not.toHaveProperty('_id');
    expect(cacheService.set).toHaveBeenCalledWith(
      expect.stringContaining('organizations:v1:getAll:'),
      expect.objectContaining({ result: [organization.serialize()] })
    );
  });

  it('uses cache for read operations and invalidates after mutations', async () => {
    expect.hasAssertions();
    const dataRepository = {
      create: jest.fn().mockResolvedValue({ id: 'o1', name: 'Org' }),
      update: jest.fn().mockResolvedValue({ id: 'o1', name: 'Org Updated' }),
      delete: jest.fn().mockResolvedValue(true),
      getOneById: jest.fn().mockResolvedValue({ id: 'o1', name: 'Org' }),
      getAll: jest.fn().mockResolvedValue({
        page: 1,
        size: 10,
        total: 1,
        result: [{ id: 'o1', name: 'Org' }]
      })
    };
    const cacheService = {
      get: jest.fn().mockResolvedValueOnce(undefined).mockResolvedValueOnce({ id: 'o1', name: 'Org' }),
      set: jest.fn().mockResolvedValue(undefined),
      getVersion: jest.fn().mockResolvedValue(1),
      bumpVersion: jest.fn().mockResolvedValue(2)
    };
    const service = OrganizationService.compile({
      dataRepository,
      services: { cacheService }
    } as any);

    await service.getOneById('o1');
    expect(dataRepository.getOneById).toHaveBeenCalledTimes(1);
    expect(cacheService.set).toHaveBeenCalledWith(
      'organizations:v1:getOneById:o1',
      { id: 'o1', name: 'Org' }
    );

    await service.getOneById('o1');
    expect(dataRepository.getOneById).toHaveBeenCalledTimes(1);

    await service.getAll({ ids: ['o1', 'o2'] as any }, { page: 1, size: 10 });
    cacheService.get.mockResolvedValueOnce({
      page: 1,
      size: 10,
      total: 1,
      result: [{ id: 'o1', name: 'Org' }]
    });
    await service.getAll({}, { page: 1, size: 10 });
    expect(dataRepository.getAll).toHaveBeenCalledTimes(1);

    await service.update('o1', { name: 'Org Updated' } as any);
    expect(cacheService.bumpVersion).toHaveBeenCalledWith('organizations');
  });

  it('returns service errors when repository fails', async () => {
    expect.hasAssertions();
    const { service, dataRepository } = setup();
    dataRepository.create.mockRejectedValueOnce(new Error('boom'));
    const response = await service.create({ name: 'Org' } as any);
    expect(response.error).toBeDefined();
  });

  it('covers error branches for remaining CRUD methods', async () => {
    expect.hasAssertions();
    const { service, dataRepository } = setup();

    dataRepository.update.mockRejectedValueOnce(new Error('update-fail'));
    dataRepository.delete.mockRejectedValueOnce(new Error('delete-fail'));
    dataRepository.getOneById.mockRejectedValueOnce(new Error('get-fail'));
    dataRepository.getAll.mockRejectedValueOnce(new Error('get-all-fail'));

    expect((await service.update('o1', { name: 'x' } as any)).error?.message).toBe('update-fail');
    expect((await service.delete('o1')).error?.message).toBe('delete-fail');
    expect((await service.getOneById('o1')).error?.message).toBe('get-fail');
    expect((await service.getAll({}, { page: 1, size: 10 })).error?.message).toBe('get-all-fail');
  });

  it('delegates explicit organization domain-object mutation methods', async () => {
    expect.hasAssertions();
    const { service, dataRepository } = setup();

    expect((await service.createAddress('o1', { email: 'hq@org.dev', type: 'work' } as any)).result?.id).toBe('o1');
    expect((await service.updateAddress('o1', 'a1', { email: 'new@org.dev' } as any)).result?.id).toBe('o1');
    expect((await service.deleteAddress('o1', 'a1')).result?.id).toBe('o1');

    expect((await service.createPhone('o1', { countryCode: '55', localCode: '11', number: '9999' } as any)).result?.id).toBe('o1');
    expect((await service.updatePhone('o1', 'p1', { number: '8888' } as any)).result?.id).toBe('o1');
    expect((await service.deletePhone('o1', 'p1')).result?.id).toBe('o1');

    expect((await service.createEmail('o1', { email: 'contact@org.dev', type: 'work' } as any)).result?.id).toBe('o1');
    expect((await service.updateEmail('o1', 'e1', { email: 'new@org.dev' } as any)).result?.id).toBe('o1');
    expect((await service.deleteEmail('o1', 'e1')).result?.id).toBe('o1');

    expect(dataRepository.createAddress).toHaveBeenCalledWith('o1', { email: 'hq@org.dev', type: 'work' });
    expect(dataRepository.updatePhone).toHaveBeenCalledWith('o1', 'p1', { number: '8888' });
    expect(dataRepository.deleteEmail).toHaveBeenCalledWith('o1', 'e1');
  });

  it('returns service errors for explicit mutation methods', async () => {
    expect.hasAssertions();
    const { service, dataRepository } = setup();
    dataRepository.createAddress.mockRejectedValueOnce(new Error('create-address-fail'));
    dataRepository.updateAddress.mockRejectedValueOnce(new Error('update-address-fail'));
    dataRepository.deleteAddress.mockRejectedValueOnce(new Error('delete-address-fail'));
    dataRepository.createPhone.mockRejectedValueOnce(new Error('create-phone-fail'));
    dataRepository.updatePhone.mockRejectedValueOnce(new Error('update-phone-fail'));
    dataRepository.deletePhone.mockRejectedValueOnce(new Error('delete-phone-fail'));
    dataRepository.createEmail.mockRejectedValueOnce(new Error('create-email-fail'));
    dataRepository.updateEmail.mockRejectedValueOnce(new Error('update-email-fail'));
    dataRepository.deleteEmail.mockRejectedValueOnce(new Error('delete-email-fail'));

    expect((await service.createAddress('o1', { email: 'hq@org.dev', type: 'work' } as any)).error?.message).toBe('create-address-fail');
    expect((await service.updateAddress('o1', 'a1', { email: 'new@org.dev' } as any)).error?.message).toBe('update-address-fail');
    expect((await service.deleteAddress('o1', 'a1')).error?.message).toBe('delete-address-fail');
    expect((await service.createPhone('o1', { countryCode: '55', localCode: '11', number: '9999' } as any)).error?.message).toBe('create-phone-fail');
    expect((await service.updatePhone('o1', 'p1', { number: '8888' } as any)).error?.message).toBe('update-phone-fail');
    expect((await service.deletePhone('o1', 'p1')).error?.message).toBe('delete-phone-fail');
    expect((await service.createEmail('o1', { email: 'contact@org.dev', type: 'work' } as any)).error?.message).toBe('create-email-fail');
    expect((await service.updateEmail('o1', 'e1', { email: 'new@org.dev' } as any)).error?.message).toBe('update-email-fail');
    expect((await service.deleteEmail('o1', 'e1')).error?.message).toBe('delete-email-fail');
  });
});
