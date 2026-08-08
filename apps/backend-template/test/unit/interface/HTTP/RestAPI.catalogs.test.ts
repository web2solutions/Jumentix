/* eslint-disable @typescript-eslint/no-explicit-any, jest/max-expects */
import { Express } from 'express';
import { ExpressServer } from '@src/interface/HTTP/adapters/express/ExpressServer';
import { infraHandlers } from '@src/interface/HTTP/adapters/express/handlers/infraHandlers';
import { RestAPI } from '@src/interface/HTTP/RestAPI';
import { InMemoryDbClient } from '@src/infra/persistence/InMemoryDatabase/InMemoryDbClient';
import { EHTTPFrameworks } from '@src/interface/HTTP/ports';
import { PasswordCryptoService } from '@src/infra/security/PasswordCryptoService';
import { InMemoryKeyValueStorageClient } from '@src/infra/persistence/KeyValueStorage/InMemoryKeyValueStorageClient';
import { MutexService } from '@src/infra/mutex/adapter/MutexService';
import { JwtService } from '@src/infra/jwt/JwtService';
import { composeUsersAuthServices } from '@src/modules/Users';
import { _DOCS_PREFIX_ } from '@src/config/constants';
import { composeCatalogsServices } from '@src/modules/Catalogs';
// eslint-disable-next-line import/no-unresolved
import { InMemoryMessageMediatorAdapter } from '@jumentix/message-mediator';

/**
 * Unit suite for the Catalogs wiring inside RestAPI (JUM-491): the REAL
 * RestAPI is constructed against the REAL OAS spec, the REAL Express server
 * adapter and the REAL in-memory database client — the same boot the
 * production adapters run — so the catalogs composition path
 * (`composeCatalogsModule`, the `/catalogs` route/controller registration and
 * the handler factories) executes exactly as deployed, not as a description
 * of it. The pattern mirrors the existing `RealtimeAPIBase` unit suite
 * (real infra services, memoization asserted through the protected method).
 */

const databaseClient = InMemoryDbClient;
const passwordCryptoService = PasswordCryptoService.compile();
const keyValueStorageClient = InMemoryKeyValueStorageClient.compile();
const mutexService = MutexService.compile(keyValueStorageClient);
const jwtService = JwtService.compile();
const { authService } = composeUsersAuthServices({
  databaseClient,
  passwordCryptoService,
  mutexService,
  jwtService
});

const previousHttpPort = process.env.JUMENTIX_HTTP_PORT;

const restoreHttpPort = () => {
  if (previousHttpPort === undefined) {
    delete process.env.JUMENTIX_HTTP_PORT;
    return;
  }
  process.env.JUMENTIX_HTTP_PORT = previousHttpPort;
};

describe('restAPI catalogs composition wiring', () => {
  // Stub the framework-handler factory at the prototype: route REGISTRATION
  // (spec parsing, controller composition, endpoint paths) stays real, but
  // loading every module's framework handlers is the integration suites'
  // proof (test/integration/Express/*), not this unit file's — importing
  // them here would drag their handler bodies into the unit coverage set.
  let handlerFactorySpy: jest.SpyInstance | undefined;

  beforeEach(() => {
    handlerFactorySpy = jest
      .spyOn(RestAPI.prototype as any, 'getHandlerFactory')
      .mockImplementation(({ endPointConfig }: any) => ({
        path: '/stubbed',
        method: 'get',
        handler: async () => undefined,
        operationId: endPointConfig?.operationId
      }));
  });

  afterEach(() => {
    handlerFactorySpy?.mockRestore();
  });

  it('registers the catalogs routes from the OAS spec with a composed controller', () => {
    expect.hasAssertions();
    const webServer = ExpressServer.compile();

    // Construction registers every spec route, including /catalogs — a
    // missing catalogs composition fails closed right here.
    const api = new RestAPI<Express>({
      databaseClient,
      webServer,
      infraHandlers,
      serverType: EHTTPFrameworks.express,
      authService,
      passwordCryptoService,
      keyValueStorageClient,
      mutexService,
      messageMediator: new InMemoryMessageMediatorAdapter()
    });

    expect(api).toBeDefined();
    const registeredOperations = (handlerFactorySpy as jest.SpyInstance).mock.calls.map(
      (call) => (call[0] as any).operationId
    );
    expect(registeredOperations).toStrictEqual(expect.arrayContaining([
      'getAllCatalogs',
      'createCatalog',
      'getCatalogById',
      'updateCatalog',
      'deleteCatalog',
      'restoreCatalog'
    ]));
  });

  it('composes catalogs module once and reuses the memoized composition', () => {
    expect.hasAssertions();
    const webServer = ExpressServer.compile();
    const api = new RestAPI<Express>({
      databaseClient,
      webServer,
      infraHandlers,
      serverType: EHTTPFrameworks.express,
      authService,
      passwordCryptoService,
      keyValueStorageClient,
      mutexService
    });

    const composedOne = (api as any).composeCatalogsModule();
    const composedTwo = (api as any).composeCatalogsModule();
    expect(composedTwo).toBe(composedOne);
    expect(composedOne.catalogUseCases).toBeDefined();
    expect(composedOne.catalogService).toBeDefined();
    expect(composedOne.dataRepository).toBeDefined();
  });

  it('propagates the module resolution error for a missing handler module', () => {
    expect.hasAssertions();
    const webServer = ExpressServer.compile();
    const api = new RestAPI<Express>({
      databaseClient,
      webServer,
      infraHandlers,
      serverType: EHTTPFrameworks.express,
      authService,
      passwordCryptoService,
      keyValueStorageClient,
      mutexService
    });
    // Restore AFTER construction: the real factory runs only for these calls.
    handlerFactorySpy?.mockRestore();
    expect(() => (api as any).getHandlerFactory({
      moduleName: 'Missing',
      operationId: 'notThere'
    })).toThrow(/Handler not found for module Missing|Could not locate module/);

    const catalogsHandler = (api as any).getHandlerFactory({
      moduleName: 'Catalogs',
      operationId: 'getAllCatalogs',
      endPointConfig: { operationId: 'getAllCatalogs' },
      controller: {}
    });
    expect(catalogsHandler.path).toBe('/catalogs');
    expect(catalogsHandler.method).toBe('get');
  });

  it('propagates the module resolution error for a missing controller module', () => {
    expect.hasAssertions();
    expect(() => (RestAPI as any).getControllerModule('Users', 'MissingController'))
      .toThrow(/Could not locate module|Controller MissingController not found/);
  });

  it('honours a plain event bus when no mediator is configured', () => {
    expect.hasAssertions();
    const webServer = ExpressServer.compile();
    const eventBus = { publish: async () => undefined, subscribe: () => undefined };
    const api = new RestAPI<Express>({
      databaseClient,
      webServer,
      infraHandlers,
      serverType: EHTTPFrameworks.express,
      authService,
      passwordCryptoService,
      keyValueStorageClient,
      mutexService,
      eventBus
    } as any);
    expect((api as any).eventBus).toBe(eventBus);
  });

  it('declares the users composition dependencies it requires', () => {
    expect.hasAssertions();
    const baseConfig = {
      databaseClient,
      webServer: ExpressServer.compile(),
      infraHandlers,
      serverType: EHTTPFrameworks.express,
      authService
    };
    expect(() => new RestAPI<Express>(baseConfig as any))
      .toThrow('PasswordCryptoService is required to compose Users module.');
    expect(() => new RestAPI<Express>({
      ...baseConfig,
      webServer: ExpressServer.compile(),
      passwordCryptoService
    } as any)).toThrow('MutexService is required to compose Users module.');
    expect(() => new RestAPI<Express>({
      ...baseConfig,
      webServer: ExpressServer.compile(),
      passwordCryptoService,
      mutexService,
      authService: { authenticate: () => Promise.resolve({}) }
    } as any)).toThrow('AuthService with JwtService is required to compose Users module.');
  });

  it('rejects seed operations when the use cases fail', async () => {
    expect.hasAssertions();
    const webServer = ExpressServer.compile();
    const api = new RestAPI<Express>({
      databaseClient,
      webServer,
      infraHandlers,
      serverType: EHTTPFrameworks.express,
      authService,
      passwordCryptoService,
      keyValueStorageClient,
      mutexService
    });
    (api as any).usersComposition = {
      userUseCases: {
        create: async () => ({ error: new Error('db down') }),
        delete: async () => ({ error: new Error('db down') }),
        getAll: async () => ({ result: [{ id: 'u-1' }] })
      },
      organizationUseCases: {
        getOneById: async () => ({ result: { id: 'org-1' } }),
        create: async () => ({ result: { id: 'org-1' } })
      }
    };
    await expect(api.seedUsers()).rejects.toThrow('db down');
    await expect(api.deleteUsers()).rejects.toThrow('db down');

    (api as any).usersComposition = {
      organizationUseCases: {
        getOneById: async () => ({ result: null }),
        create: async () => ({ error: new Error('org db down') })
      }
    };
    await expect(api.seedOrganizations()).rejects.toThrow('org db down');

    (api as any).usersComposition = {
      organizationUseCases: {
        getOneById: async () => ({ result: null }),
        create: async () => ({ result: undefined })
      }
    };
    await expect(api.seedOrganizations()).rejects.toThrow('Organization seed failed');

    (api as any).usersComposition = {
      userUseCases: {
        create: async () => ({ result: undefined })
      },
      organizationUseCases: {
        getOneById: async () => ({ result: { id: 'org-1' } })
      }
    };
    await expect(api.seedUsers()).rejects.toThrow('User seed failed');

    (api as any).usersComposition = {
      userUseCases: {
        delete: async () => ({ result: undefined }),
        getAll: async () => ({ result: [{ id: 'u-1' }] })
      },
      organizationUseCases: {
        getOneById: async () => ({ result: { id: 'org-1' } })
      }
    };
    await expect(api.deleteUsers()).rejects.toThrow('User delete failed');
  });

  it('serves the asyncapi versions document through the infra handler', () => {
    expect.hasAssertions();
    const webServer = ExpressServer.compile();
    const endpoints: any[] = [];
    const registerSpy = jest
      .spyOn(webServer, 'endPointRegister')
      .mockImplementation((endPoint: any) => {
        endpoints.push(endPoint);
        return endPoint;
      });
    // eslint-disable-next-line no-new
    new RestAPI<Express>({
      databaseClient,
      webServer,
      infraHandlers,
      serverType: EHTTPFrameworks.express,
      authService,
      passwordCryptoService,
      keyValueStorageClient,
      mutexService
    });
    const asyncVersions = endpoints.find(
      (endPoint) => endPoint.path === `${_DOCS_PREFIX_}/asyncapi/versions`
    );
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    asyncVersions.handler({}, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].versions['1.0.0']).toContain('asyncapi');
    registerSpy.mockRestore();
  });

  it('starts, seeds, deletes and stops over the in-memory driver', async () => {
    expect.hasAssertions();
    const webServer = ExpressServer.compile();
    const api = new RestAPI<Express>({
      databaseClient,
      webServer,
      infraHandlers,
      serverType: EHTTPFrameworks.express,
      authService,
      passwordCryptoService,
      keyValueStorageClient,
      mutexService
    });
    process.env.JUMENTIX_HTTP_PORT = '0';
    try {
      await api.start();
      await api.start();
      await api.seedData();
      const deleted = await api.deleteUsers();
      expect(deleted.length).toBeGreaterThan(0);
      await api.stop();
    } finally {
      restoreHttpPort();
    }
  });

  it('passes the composed use cases to the catalogs controller factory', () => {
    expect.hasAssertions();
    const webServer = ExpressServer.compile();
    const composition = composeCatalogsServices({ databaseClient });
    const factorySpy = jest.fn().mockImplementation(() => ({}));
    const getControllerModuleSpy = jest
      .spyOn(RestAPI as any, 'getControllerModule')
      .mockReturnValue(factorySpy);

    // eslint-disable-next-line no-new
    new RestAPI<Express>({
      databaseClient,
      webServer,
      infraHandlers,
      serverType: EHTTPFrameworks.express,
      authService,
      passwordCryptoService,
      keyValueStorageClient,
      mutexService
    });

    expect(factorySpy).toHaveBeenCalledWith(expect.anything());
    const catalogsCall = factorySpy.mock.calls
      .map((call) => call[0])
      .find((factoryArg) => factoryArg.catalogUseCases);
    expect(catalogsCall.catalogUseCases).toBeDefined();
    expect(typeof catalogsCall.catalogUseCases.getAll).toBe('function');
    expect(typeof catalogsCall.catalogUseCases.create).toBe('function');
    expect(catalogsCall.catalogUseCases).not.toBe(composition.catalogUseCases);
    getControllerModuleSpy.mockRestore();
  });
});
