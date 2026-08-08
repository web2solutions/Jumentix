/* eslint-disable jest/max-expects, @typescript-eslint/no-var-requires */
import fs from 'fs';
import YAML from 'yaml';
import { OpenAPIV3 } from 'openapi-types';
import { CatalogController } from '@src/modules/Catalogs/adapters/in/http/controllers/CatalogController';
import { CatalogDataRepository } from '@src/modules/Catalogs/adapters/out/persistence/CatalogDataRepository';
import { CatalogService } from '@src/modules/Catalogs/service/CatalogService';
import { CatalogUseCases } from '@src/modules/Catalogs/application/use-cases/CatalogUseCases';
import { InMemoryRelationalStore } from '@src/infra/persistence/InMemoryDatabase/Stores/InMemoryRelationalStore';
import { CatalogCreateRequestEvent } from '@src/modules/Catalogs/events/CatalogCreateRequestEvent';
import { CatalogUpdateRequestEvent } from '@src/modules/Catalogs/events/CatalogUpdateRequestEvent';
import { CatalogDeleteRequestEvent } from '@src/modules/Catalogs/events/CatalogDeleteRequestEvent';
import { CatalogRestoreRequestEvent } from '@src/modules/Catalogs/events/CatalogRestoreRequestEvent';
import { CatalogGetAllRequestEvent } from '@src/modules/Catalogs/events/CatalogGetAllRequestEvent';
import { CatalogGetOneRequestEvent } from '@src/modules/Catalogs/events/CatalogGetOneRequestEvent';
import type { ICatalog } from '@src/modules/Catalogs/domain/Entity/ICatalog';
import type { IDatabaseClient } from '@src/infra/persistence/port/IDatabaseClient';
import { TENANT_AUTHORIZATION_REASONS } from '@src/modules/Users/domain/security/TenantAuthorizationPolicy';

/**
 * Unit suite for the catalog inbound HTTP adapter (JUM-491): the REAL
 * controller runs against the REAL use-case/service/repository stack over the
 * REAL in-memory store, and the OAS operation nodes are the REAL ones parsed
 * from `spec/1.0.0.yml` — the tenant decisions asserted here execute the same
 * contract the deployed route enforces.
 *
 * The only double is `IAuthService`, a declared in-memory double of a
 * Jumentix port (Requirement 115): it maps the `authorization` string to a
 * principal and performs no scope check of its own, because the scope matrix
 * is covered by the real `AuthService` in the Express integration suite and
 * by the Rbac unit tests. The TENANT-RBAC organization decisions under test
 * here are the controller's own.
 */

const spec = YAML.parse(fs.readFileSync('spec/1.0.0.yml', 'utf8')) as OpenAPIV3.Document;
const operations = spec.paths as Record<string, Record<string, any>>;

const createStack = (principal: Record<string, any>) => {
  const store = new InMemoryRelationalStore<ICatalog>({ relationIndexes: ['organization'] });
  const databaseClient = {
    stores: { Catalog: store },
    connect: () => Promise.resolve(),
    disconnect: () => Promise.resolve()
  } as unknown as IDatabaseClient;
  const dataRepository = CatalogDataRepository.compile({ databaseClient });
  const catalogService = CatalogService.compile({ dataRepository, services: {} });
  const catalogUseCases = CatalogUseCases.compile(catalogService);
  const authService = {
    authenticate: () => Promise.resolve({}),
    authorize: () => Promise.resolve(principal),
    throwIfUserHasNoAccessToResource: () => true
  } as any;
  const controller = new CatalogController({
    authService,
    openApiSpecification: spec,
    databaseClient,
    catalogUseCases
  } as any);
  return { controller, catalogUseCases };
};

const adminOrg1 = {
  id: 'admin-1', username: 'admin@org1.dev', organization: 'org-1', roles: ['admin']
};
const userOrg1 = {
  id: 'user-1', username: 'user@org1.dev', organization: 'org-1', roles: ['user']
};
const adminOrg2 = {
  id: 'admin-2', username: 'admin@org2.dev', organization: 'org-2', roles: ['admin']
};
const superadmin = { id: 'root', username: 'root@xpertminds.dev', roles: ['superadmin'] };

const design = { entities: [{ name: 'Invoice' }] };

describe('catalogController — TENANT-RBAC enforcement', () => {
  it('binds a tenant admin create to its own organization and stamps the actor', async () => {
    expect.hasAssertions();
    const { controller } = createStack(adminOrg1);
    const { result, error } = await controller.create(new CatalogCreateRequestEvent({
      authorization: 'Bearer token',
      input: { name: 'Billing', design },
      schemaOAS: operations['/catalogs'].post
    }));
    expect(error).toBeUndefined();
    expect(result?.organization).toBe('org-1');
    expect(result?.createdBy).toBe('admin@org1.dev');
    expect(result?.version).toBe(1);
  });

  it('denies a tenant admin creating a record for another organization', async () => {
    expect.hasAssertions();
    const { controller } = createStack(adminOrg1);
    await expect(controller.create(new CatalogCreateRequestEvent({
      authorization: 'Bearer token',
      input: { name: 'Billing', design, organization: 'org-2' },
      schemaOAS: operations['/catalogs'].post
    }))).rejects.toThrow(TENANT_AUTHORIZATION_REASONS.crossOrganization);
  });

  it('lets superadmin choose the organization explicitly', async () => {
    expect.hasAssertions();
    const { controller } = createStack(superadmin);
    const { result, error } = await controller.create(new CatalogCreateRequestEvent({
      authorization: 'Bearer token',
      input: { name: 'Billing', design, organization: 'org-9' },
      schemaOAS: operations['/catalogs'].post
    }));
    expect(error).toBeUndefined();
    expect(result?.organization).toBe('org-9');
  });

  it('denies reading a record of another organization — a client cannot grant itself access', async () => {
    expect.hasAssertions();
    const { catalogUseCases } = createStack(adminOrg1);
    const created = (await catalogUseCases.create({ organization: 'org-1', name: 'Billing', design })).result!;

    const foreignController = new CatalogController({
      authService: {
        authenticate: () => Promise.resolve({}),
        authorize: () => Promise.resolve(adminOrg2),
        throwIfUserHasNoAccessToResource: () => true
      },
      openApiSpecification: spec,
      databaseClient: { stores: {} } as any,
      catalogUseCases
    } as any);
    await expect(foreignController.getOneById(new CatalogGetOneRequestEvent({
      authorization: 'Bearer token',
      params: { id: created.id },
      schemaOAS: operations['/catalogs/{id}'].get
    }))).rejects.toThrow(TENANT_AUTHORIZATION_REASONS.crossOrganization);
  });

  it('scopes the collection to the caller organization and honours includeDeleted', async () => {
    expect.hasAssertions();
    const { controller, catalogUseCases } = createStack(adminOrg1);
    const own = (await catalogUseCases.create({ organization: 'org-1', name: 'Billing', design })).result!;
    await catalogUseCases.create({ organization: 'org-2', name: 'Shipping', design });
    await catalogUseCases.delete(own.id, 1);

    const activeOnly = await controller.getAll(new CatalogGetAllRequestEvent({
      authorization: 'Bearer token',
      queryString: { page: '1', size: '10' },
      schemaOAS: operations['/catalogs'].get
    }));
    expect(activeOnly.result).toHaveLength(0);

    const withDeleted = await controller.getAll(new CatalogGetAllRequestEvent({
      authorization: 'Bearer token',
      queryString: { page: '1', size: '10', includeDeleted: 'true' },
      schemaOAS: operations['/catalogs'].get
    }));
    expect(withDeleted.result).toHaveLength(1);
    expect(withDeleted.result?.[0].name).toBe('Billing');
    expect(withDeleted.result?.[0].deletedAt).not.toBe('');
  });

  it('updates with the current version for a same-team user role', async () => {
    expect.hasAssertions();
    const { catalogUseCases } = createStack(adminOrg1);
    const created = (await catalogUseCases.create({ organization: 'org-1', name: 'Billing', design })).result!;

    const teammate = new CatalogController({
      authService: {
        authenticate: () => Promise.resolve({}),
        authorize: () => Promise.resolve(userOrg1),
        throwIfUserHasNoAccessToResource: () => true
      },
      openApiSpecification: spec,
      databaseClient: { stores: {} } as any,
      catalogUseCases
    } as any);
    const { result, error } = await teammate.update(new CatalogUpdateRequestEvent({
      authorization: 'Bearer token',
      params: { id: created.id },
      input: { version: 1, description: 'teammate edit' },
      schemaOAS: operations['/catalogs/{id}'].put
    }));
    expect(error).toBeUndefined();
    expect(result?.version).toBe(2);
    expect(result?.updatedBy).toBe('user@org1.dev');
  });

  it('propagates the stale-version conflict with the reconciliation metadata', async () => {
    expect.hasAssertions();
    const { controller, catalogUseCases } = createStack(adminOrg1);
    const created = (await catalogUseCases.create({ organization: 'org-1', name: 'Billing', design })).result!;
    await catalogUseCases.update(created.id, { version: 1, description: 'winner' });

    const { result, error } = await controller.update(new CatalogUpdateRequestEvent({
      authorization: 'Bearer token',
      params: { id: created.id },
      input: { version: 1, description: 'stale' },
      schemaOAS: operations['/catalogs/{id}'].put
    }));
    expect(result).toBeUndefined();
    expect((error as any).code).toBe('GENERIC.CONFLICT');
    expect((error as any).metadata.currentVersion).toBe(2);
  });

  it('rejects a delete without a parseable version', async () => {
    expect.hasAssertions();
    const { controller, catalogUseCases } = createStack(adminOrg1);
    const created = (await catalogUseCases.create({ organization: 'org-1', name: 'Billing', design })).result!;
    await expect(controller.delete(new CatalogDeleteRequestEvent({
      authorization: 'Bearer token',
      params: { id: created.id },
      queryString: { version: 'not-a-number' },
      schemaOAS: operations['/catalogs/{id}'].delete
    }))).rejects.toThrow('version must be a positive integer');
  });

  it('deletes and restores with the expected version', async () => {
    expect.hasAssertions();
    const { controller, catalogUseCases } = createStack(adminOrg1);
    const created = (await catalogUseCases.create({ organization: 'org-1', name: 'Billing', design })).result!;

    const deleted = await controller.delete(new CatalogDeleteRequestEvent({
      authorization: 'Bearer token',
      params: { id: created.id },
      queryString: { version: '1' },
      schemaOAS: operations['/catalogs/{id}'].delete
    }));
    expect(deleted.error).toBeUndefined();
    expect(deleted.result).toBe(true);

    const restored = await controller.restore(new CatalogRestoreRequestEvent({
      authorization: 'Bearer token',
      params: { id: created.id },
      input: { version: 2 },
      schemaOAS: operations['/catalogs/{id}/restore'].post
    }));
    expect(restored.error).toBeUndefined();
    expect(restored.result?.deletedAt).toBe('');
    expect(restored.result?.version).toBe(3);
  });

  it('reads a record directly by id for a same-organization caller', async () => {
    expect.hasAssertions();
    const { controller, catalogUseCases } = createStack(adminOrg1);
    const created = (await catalogUseCases.create({ organization: 'org-1', name: 'Billing', design })).result!;
    const { result, error } = await controller.getOneById(new CatalogGetOneRequestEvent({
      authorization: 'Bearer token',
      params: { id: created.id },
      schemaOAS: operations['/catalogs/{id}'].get
    }));
    expect(error).toBeUndefined();
    expect(result?.id).toBe(created.id);
  });

  it('propagates the not-found error for a missing record', async () => {
    expect.hasAssertions();
    const { controller } = createStack(adminOrg1);
    await expect(controller.getOneById(new CatalogGetOneRequestEvent({
      authorization: 'Bearer token',
      params: { id: '123e4567-e89b-42d3-a456-426614174000' },
      schemaOAS: operations['/catalogs/{id}'].get
    }))).rejects.toThrow('Record not found');
  });

  it('compiles through the static factory like the route registration does', () => {
    expect.hasAssertions();
    const { catalogUseCases } = createStack(adminOrg1);
    const controller = CatalogController.compile({
      authService: {
        authenticate: () => Promise.resolve({}),
        authorize: () => Promise.resolve(adminOrg1),
        throwIfUserHasNoAccessToResource: () => true
      },
      openApiSpecification: spec,
      databaseClient: { stores: {} } as any,
      catalogUseCases
    } as any);
    expect(controller).toBeInstanceOf(CatalogController);
  });

  it('fails closed when the use cases are not wired', () => {
    expect.hasAssertions();
    expect(() => new CatalogController({
      authService: { authenticate: () => Promise.resolve({}) } as any,
      openApiSpecification: spec,
      databaseClient: { stores: {} } as any
    } as any)).toThrow('CatalogUseCases is not implemented');
  });
});
