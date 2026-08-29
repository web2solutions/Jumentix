/* eslint-disable @typescript-eslint/no-explicit-any */

import fs from 'fs';
import os from 'os';
import path from 'path';
import type {
  IAsyncOperationRequest,
  IRealtimeAPIFactory,
  IRealtimeOperationEntry
} from '@src/interface/Async/RealtimeAPIBase';
import {
  RealtimeAPIBase
} from '@src/interface/Async/RealtimeAPIBase';
import { PasswordCryptoService } from '@src/infra/security/PasswordCryptoService';
import { InMemoryKeyValueStorageClient } from '@src/infra/persistence/KeyValueStorage/InMemoryKeyValueStorageClient';
import { MutexService } from '@src/infra/mutex/adapter/MutexService';
import { JwtService } from '@src/infra/jwt/JwtService';
import { composeUsersAuthServices } from '@src/modules/Users';
import { InMemoryDbClient } from '@src/infra/persistence/InMemoryDatabase/InMemoryDbClient';

class TestRealtimeAPI extends RealtimeAPIBase {
  public constructor(config: IRealtimeAPIFactory, autoBuild = false) {
    super(config, autoBuild);
  }

  public addOperation(entry: IRealtimeOperationEntry): void {
    this.registerOperation(entry);
  }

  public async run(request: IAsyncOperationRequest) {
    return this.executeOperation(request);
  }
}

type ModuleLoader = (request: string, parent: unknown, isMain: boolean) => unknown;

const loadModule = (
  moduleLoads: Map<string, ModuleLoader>,
  originalLoad: ModuleLoader,
  request: string,
  parent: unknown,
  isMain: boolean
): unknown => {
  const mockedLoad = moduleLoads.get(request);
  if (mockedLoad) return mockedLoad(request, parent, isMain);
  return originalLoad(request, parent, isMain);
};

describe('realtime api base', () => {
  const databaseClient = {
    connect: jest.fn(),
    disconnect: jest.fn()
  } as any;

  it('executes operation successfully', async () => {
    expect.hasAssertions();
    const controller = {
      create: jest.fn().mockResolvedValue({
        result: { id: '1' }
      })
    };
    const api = new TestRealtimeAPI({ databaseClient });
    api.addOperation({
      version: '1.0.0',
      operationId: 'create',
      moduleName: 'Users',
      endPointConfig: { operationId: 'create' },
      controller,
      controllerMethod: 'create'
    });

    const response = await api.run({
      operationId: 'create',
      input: { username: 'john' }
    });

    expect(response.ok).toBe(true);
    expect(response.result).toStrictEqual({ id: '1' });
  });

  it('returns error when operation is missing', async () => {
    expect.hasAssertions();
    const api = new TestRealtimeAPI({ databaseClient });
    const response = await api.run({
      operationId: 'missing'
    });
    expect(response.ok).toBe(false);
    expect(response.error?.message).toContain('Operation "missing" not found');
  });

  it('returns error when controller method is missing', async () => {
    expect.hasAssertions();
    const api = new TestRealtimeAPI({ databaseClient });
    api.addOperation({
      version: '1.0.0',
      operationId: 'create',
      moduleName: 'Users',
      endPointConfig: { operationId: 'create' },
      controller: {},
      controllerMethod: 'create'
    });
    const response = await api.run({
      operationId: 'create'
    });
    expect(response.ok).toBe(false);
    expect(response.error?.message).toContain('Controller method "create" not found');
  });

  it('returns service error branch', async () => {
    expect.hasAssertions();
    const api = new TestRealtimeAPI({ databaseClient });
    api.addOperation({
      version: '1.0.0',
      operationId: 'create',
      moduleName: 'Users',
      endPointConfig: { operationId: 'create' },
      controller: {
        create: jest.fn().mockResolvedValue({
          error: new Error('service failed')
        })
      },
      controllerMethod: 'create'
    });
    const response = await api.run({
      operationId: 'create'
    });
    expect(response.ok).toBe(false);
    expect(response.error?.message).toBe('service failed');
  });

  it('executes runtime handler branch and resolves versioned operation', async () => {
    expect.hasAssertions();
    const runtimeHandler = jest.fn().mockResolvedValue({
      ok: true,
      operationId: 'login',
      result: { from: 'runtime' }
    });
    const api = new TestRealtimeAPI({ databaseClient });
    api.addOperation({
      version: '1.0.0',
      operationId: 'login',
      moduleName: 'Users',
      endPointConfig: { operationId: 'login' },
      controller: {},
      controllerMethod: 'login',
      runtimeHandler
    });

    const response = await api.run({
      version: '1.0.0',
      operationId: 'login',
      input: { username: 'john' }
    });

    expect(runtimeHandler).toHaveBeenCalledWith(expect.objectContaining({
      version: '1.0.0',
      operationId: 'login'
    }));
    expect(response.ok).toBe(true);
    expect(response.result).toStrictEqual({ from: 'runtime' });
  });

  it('returns default error shape for non-standard thrown error', async () => {
    expect.hasAssertions();
    const api = new TestRealtimeAPI({ databaseClient });
    api.addOperation({
      version: '1.0.0',
      operationId: 'create',
      moduleName: 'Users',
      endPointConfig: { operationId: 'create' },
      controller: {
        create: jest.fn().mockResolvedValue({
          error: {}
        })
      },
      controllerMethod: 'create'
    });

    const response = await api.run({
      operationId: 'create'
    });
    expect(response.ok).toBe(false);
    expect(response.error?.name).toBe('Error');
    expect(response.error?.message).toBe('Unknown error');
  });

  it('covers compose users module required dependency branches', () => {
    expect.hasAssertions();
    const apiMissingPassword = new TestRealtimeAPI({ databaseClient });
    expect(() => (apiMissingPassword as any).composeUsersModule()).toThrow(
      'PasswordCryptoService is required to compose Users module.'
    );

    const apiMissingMutex = new TestRealtimeAPI({
      databaseClient,
      passwordCryptoService: PasswordCryptoService.compile()
    });
    expect(() => (apiMissingMutex as any).composeUsersModule()).toThrow(
      'MutexService is required to compose Users module.'
    );

    const apiMissingAuth = new TestRealtimeAPI({
      databaseClient,
      passwordCryptoService: PasswordCryptoService.compile(),
      mutexService: MutexService.compile(InMemoryKeyValueStorageClient.compile())
    });
    expect(() => (apiMissingAuth as any).composeUsersModule()).toThrow(
      'AuthService with JwtService is required to compose Users module.'
    );
  });

  it('composes users module once and reuses memoized composition', () => {
    expect.hasAssertions();
    const passwordCryptoService = PasswordCryptoService.compile();
    const keyValueStorageClient = InMemoryKeyValueStorageClient.compile();
    const mutexService = MutexService.compile(keyValueStorageClient);
    const jwtService = JwtService.compile();
    const { authService } = composeUsersAuthServices({
      databaseClient: InMemoryDbClient,
      passwordCryptoService,
      mutexService,
      jwtService
    });

    const api = new TestRealtimeAPI({
      databaseClient: InMemoryDbClient,
      passwordCryptoService,
      mutexService,
      authService
    });

    const composedOne = (api as any).composeUsersModule();
    const composedTwo = (api as any).composeUsersModule();
    expect(composedOne).toBeDefined();
    expect(composedTwo).toBe(composedOne);
  });

  it('covers controller metadata and controller module resolution branches', () => {
    expect.hasAssertions();
    expect((RealtimeAPIBase as any).resolveControllerMetadata('auth')).toStrictEqual({
      moduleName: 'Users',
      controllerName: 'AuthController'
    });
    expect((RealtimeAPIBase as any).resolveControllerMetadata('organizations')).toStrictEqual({
      moduleName: 'Users',
      controllerName: 'OrganizationController'
    });
    expect((RealtimeAPIBase as any).resolveControllerMetadata('users')).toStrictEqual({
      moduleName: 'Users',
      controllerName: 'UserController'
    });

    const organizationControllerModule = (RealtimeAPIBase as any).getControllerModule('Users', 'OrganizationController');
    expect(organizationControllerModule).toBeDefined();
    expect(() => (RealtimeAPIBase as any).getControllerModule('Missing', 'Controller')).toThrow(
      'Controller Controller not found for module Missing.'
    );
  });

  it('builds operations from OAS spec and lists operation ids', () => {
    expect.hasAssertions();
    const specDir = fs.mkdtempSync(path.join(os.tmpdir(), 'realtime-oas-'));
    const filePath = path.join(specDir, '1.0.0.yml');
    fs.writeFileSync(filePath, `
openapi: 3.1.0
info:
  version: 1.0.0
  title: test
paths:
  /tasks:
    post:
      operationId: create
`, 'utf8');

    const mockControllerFactory = jest.fn().mockImplementation(() => ({
      create: jest.fn().mockResolvedValue({ result: { id: 'new-user' } })
    }));
    const getControllerModuleSpy = jest
      .spyOn(RealtimeAPIBase as any, 'getControllerModule')
      .mockReturnValue(mockControllerFactory);

    const api = new TestRealtimeAPI(
      {
        databaseClient,
        specDir
      },
      true
    );

    const operationIds = (api as any).listOperationIds();
    expect(operationIds).toContain('create');

    getControllerModuleSpy.mockRestore();
    fs.rmSync(specDir, { recursive: true, force: true });
  });

  it('ignores non-OpenAPI files and endpoints without operation ids while building operations', () => {
    expect.hasAssertions();
    const specDir = fs.mkdtempSync(path.join(os.tmpdir(), 'realtime-oas-sparse-'));
    fs.writeFileSync(path.join(specDir, 'readme.txt'), 'not a spec', 'utf8');
    fs.writeFileSync(path.join(specDir, 'broken.yml'), 'openapi: 3.1.0\ninfo:\n  version: 1.0.0\n', 'utf8');
    fs.writeFileSync(path.join(specDir, '2.0.0.yaml'), `
openapi: 3.1.0
info:
  version: 2.0.0
  title: sparse
paths:
  /health:
    get:
      summary: no operation id
`, 'utf8');

    const api = new TestRealtimeAPI({ databaseClient, specDir }, true);

    expect((api as any).listOperationIds()).toStrictEqual([]);
    fs.rmSync(specDir, { recursive: true, force: true });
  });

  it('maps unmapped endpoint operation ids to a same-named controller method', () => {
    expect.hasAssertions();
    const spec = {
      openapi: '3.1.0',
      info: { version: '1.0.0', title: 'test' },
      paths: { '/reports': { post: { operationId: 'publishReport' } } }
    };
    const controller = { publishReport: jest.fn().mockResolvedValue({ result: { ok: true } }) };
    const controllerFactory = jest.fn().mockImplementation(() => controller);
    const getControllerModuleSpy = jest
      .spyOn(RealtimeAPIBase as any, 'getControllerModule')
      .mockReturnValue(controllerFactory);
    const api = new TestRealtimeAPI({ databaseClient });

    (api as any).registerOperationsFromSpec('1.0.0', spec);

    expect((api as any).operations.get('1.0.0:publishReport').controllerMethod)
      .toBe('publishReport');
    getControllerModuleSpy.mockRestore();
  });

  it('registers no operations for empty OAS paths and treats missing path blocks as empty', () => {
    expect.hasAssertions();
    const api = new TestRealtimeAPI({ databaseClient });

    (api as any).registerOperationsFromSpec('1.0.0', { openapi: '3.1.0', paths: undefined });
    (api as any).registerOperationsFromSpec('1.0.1', {
      openapi: '3.1.0',
      paths: { '/missing': undefined }
    });

    expect((api as any).listOperationIds()).toStrictEqual([]);
  });

  it('composes Users dependencies when registering auth endpoints', () => {
    expect.hasAssertions();
    const authService = { login: jest.fn() };
    const userService = { getOneById: jest.fn() };
    const userUseCases = { create: jest.fn() };
    const organizationUseCases = { list: jest.fn() };
    const authUseCases = { authenticate: jest.fn() };
    const controllerFactory = jest.fn();
    controllerFactory.mockImplementation(() => ({ login: jest.fn() }));
    const getControllerModuleSpy = jest
      .spyOn(RealtimeAPIBase as any, 'getControllerModule')
      .mockReturnValue(controllerFactory);
    const api = new TestRealtimeAPI({ databaseClient });
    const composeUsersModuleSpy = jest.spyOn(api as any, 'composeUsersModule').mockReturnValue({
      authService,
      userService,
      userUseCases,
      organizationUseCases,
      authUseCases
    });

    (api as any).registerOperationFromEndpoint({
      version: '1.0.0',
      spec: { openapi: '3.1.0', info: { version: '1.0.0', title: 'test' }, paths: {} },
      path: '/auth/login',
      endPointConfig: { operationId: 'login' }
    });

    expect(composeUsersModuleSpy).toHaveBeenCalledTimes(1);
    expect(controllerFactory).toHaveBeenCalledWith(expect.objectContaining({
      authService,
      userService,
      userUseCases,
      organizationUseCases,
      authUseCases
    }));
    composeUsersModuleSpy.mockRestore();
    getControllerModuleSpy.mockRestore();
  });

  it('returns undefined runtime handler when interface runtime factory is disabled', () => {
    expect.hasAssertions();
    const apiWithoutInterface = new TestRealtimeAPI({ databaseClient });
    const disabled = (apiWithoutInterface as any).getRuntimeHandlerFactory({
      moduleName: 'Users',
      operationId: 'create',
      controllerMethod: 'create',
      controller: {},
      endPointConfig: {}
    });
    expect(disabled).toBeUndefined();
  });

  it('returns undefined when runtime handler module cannot be resolved', () => {
    expect.hasAssertions();
    const apiWithInterface = new TestRealtimeAPI({
      databaseClient,
      interfaceType: 'websocketapi',
      frameworkName: 'socket-io'
    });
    const missing = (apiWithInterface as any).getRuntimeHandlerFactory({
      moduleName: 'Missing',
      operationId: 'create',
      controllerMethod: 'create',
      controller: {},
      endPointConfig: {}
    });
    expect(missing).toBeUndefined();
  });

  it('returns undefined when the runtime handler module exports no factory', () => {
    expect.hasAssertions();
    const nodeModule = require('module');
    const originalLoad = nodeModule._load;
    const moduleLoads = new Map<string, ModuleLoader>([
      [
        '@src/modules/Users/interface/websocketapi/frameworks/socket-io/handlers/notFactory',
        () => ({ default: 'not a function' })
      ]
    ]);
    const loadSpy = jest.spyOn(nodeModule, '_load').mockImplementation((...args: unknown[]) => {
      const [request, parent, isMain] = args as [string, unknown, boolean];
      return loadModule(moduleLoads, originalLoad, request, parent, isMain);
    });
    const api = new TestRealtimeAPI({
      databaseClient,
      interfaceType: 'websocketapi',
      frameworkName: 'socket-io'
    });

    const handler = (api as any).getRuntimeHandlerFactory({
      moduleName: 'Users',
      operationId: 'notFactory',
      controllerMethod: 'notFactory',
      controller: {},
      endPointConfig: {}
    });

    expect(handler).toBeUndefined();
    loadSpy.mockRestore();
  });

  it('uses message mediator as event bus in constructor', () => {
    expect.hasAssertions();
    const messageMediator = { publish: jest.fn(), subscribe: jest.fn() } as any;
    const api = new TestRealtimeAPI({
      databaseClient,
      messageMediator,
      interfaceType: 'websocketapi',
      frameworkName: 'socket-io'
    });

    expect((api as any).eventBus).toBe(messageMediator);
  });

  it('creates runtime handler from framework module and invokes controller through event wrapper', async () => {
    expect.hasAssertions();
    const api = new TestRealtimeAPI({
      databaseClient,
      interfaceType: 'websocketapi',
      frameworkName: 'socket-io'
    });

    const controller = {
      login: jest.fn().mockResolvedValue({ result: { token: 'abc' } })
    };
    const runtimeHandler = (api as any).getRuntimeHandlerFactory({
      moduleName: 'Users',
      operationId: 'login',
      controllerMethod: 'login',
      controller,
      endPointConfig: { operationId: 'login' }
    });

    expect(typeof runtimeHandler).toBe('function');
    const response = await runtimeHandler({
      operationId: 'login',
      input: { username: 'john' }
    });
    expect(controller.login).toHaveBeenCalledWith(expect.any(Object));
    expect(response).toMatchObject({
      ok: true,
      operationId: 'login',
      result: { token: 'abc' },
      metadata: expect.objectContaining({
        channel: 'api:login:response'
      })
    });
  });

  it('covers runtime handler service error and missing framework handler branches', async () => {
    expect.hasAssertions();
    const api = new TestRealtimeAPI({
      databaseClient,
      interfaceType: 'websocketapi',
      frameworkName: 'socket-io'
    });

    const serviceErrorHandler = (api as any).getRuntimeHandlerFactory({
      moduleName: 'Users',
      operationId: 'login',
      controllerMethod: 'login',
      controller: {
        login: jest.fn().mockResolvedValue({ error: new Error('runtime service failed') })
      },
      endPointConfig: { operationId: 'login' }
    });
    await expect(serviceErrorHandler({
      operationId: 'login',
      input: {}
    })).rejects.toThrow('runtime service failed');

    const missingHandler = (api as any).getRuntimeHandlerFactory({
      moduleName: 'Users',
      operationId: 'missing-handler',
      controllerMethod: 'missing-handler',
      controller: {
        'missing-handler': jest.fn().mockResolvedValue({ result: true })
      },
      endPointConfig: { operationId: 'missing-handler' }
    });
    expect(missingHandler).toBeUndefined();
  });

  it('maps minimal runtime requests through default event payloads', async () => {
    expect.hasAssertions();
    const api = new TestRealtimeAPI({
      databaseClient,
      interfaceType: 'websocketapi',
      frameworkName: 'socket-io'
    });
    const login = jest.fn().mockResolvedValue({ result: { ok: true } });

    const runtimeHandler = (api as any).getRuntimeHandlerFactory({
      moduleName: 'Users',
      operationId: 'login',
      controllerMethod: 'login',
      controller: { login },
      endPointConfig: { operationId: 'login' }
    });
    const response = await runtimeHandler({ operationId: 'login' });

    const [event] = login.mock.calls[0];
    expect(event.authorization).toBe('');
    expect(event.input).toStrictEqual({});
    expect(event.params).toStrictEqual({});
    expect(event.queryString).toStrictEqual({});
    expect(response.metadata).toMatchObject({
      channel: 'api:login:response',
      clientId: '',
      requestId: ''
    });
  });

  it('treats resolver-shaped non-Error runtime module failures as missing handlers', () => {
    expect.hasAssertions();
    const nodeModule = require('module');
    const originalLoad = nodeModule._load;
    const moduleLoads = new Map<string, ModuleLoader>([
      [
        '@src/modules/Users/interface/websocketapi/frameworks/socket-io/handlers/resolverString',
        () => {
          throw new Error('Could not locate module from virtual resolver');
        }
      ]
    ]);
    const loadSpy = jest.spyOn(nodeModule, '_load').mockImplementation((...args: unknown[]) => {
      const [request, parent, isMain] = args as [string, unknown, boolean];
      return loadModule(moduleLoads, originalLoad, request, parent, isMain);
    });
    const api = new TestRealtimeAPI({
      databaseClient,
      interfaceType: 'websocketapi',
      frameworkName: 'socket-io'
    });

    expect((api as any).getRuntimeHandlerFactory({
      moduleName: 'Users',
      operationId: 'resolverString',
      controllerMethod: 'resolverString',
      controller: {},
      endPointConfig: {}
    })).toBeUndefined();
    loadSpy.mockRestore();
  });

  it('treats resolver-shaped non-Error controller module failures as missing controllers', () => {
    expect.hasAssertions();
    const nodeModule = require('module');
    const originalLoad = nodeModule._load;
    const moduleLoads = new Map<string, ModuleLoader>([
      [
        '@src/modules/Virtual/adapters/in/http/controllers/VirtualController',
        () => {
          throw new Error('Could not locate module from virtual resolver');
        }
      ]
    ]);
    const loadSpy = jest.spyOn(nodeModule, '_load').mockImplementation((...args: unknown[]) => {
      const [request, parent, isMain] = args as [string, unknown, boolean];
      return loadModule(moduleLoads, originalLoad, request, parent, isMain);
    });

    expect(() => (RealtimeAPIBase as any).getControllerModule('Virtual', 'VirtualController')).toThrow(
      'Controller VirtualController not found for module Virtual.'
    );
    loadSpy.mockRestore();
  });

  it('rethrows non-resolution errors from runtime handler modules', () => {
    expect.hasAssertions();
    const api = new TestRealtimeAPI({
      databaseClient,
      interfaceType: 'websocketapi',
      frameworkName: 'socket-io'
    });

    jest.spyOn(RealtimeAPIBase as any, 'getControllerModule').mockImplementationOnce(() => {
      throw new Error('controller init failed');
    });

    expect(() => (api as any).registerOperationFromEndpoint({
      version: '1.0.0',
      spec: { openapi: '3.1.0', info: { version: '1.0.0', title: 'test' }, paths: {} },
      path: '/reports',
      endPointConfig: { operationId: 'publishReport' }
    })).toThrow('controller init failed');

    (RealtimeAPIBase as any).getControllerModule.mockRestore();
  });

  it('throws when controller module resolution fails for missing controllers', () => {
    expect.hasAssertions();
    expect(() => (RealtimeAPIBase as any).getControllerModule('Users', 'MissingController')).toThrow(
      'Controller MissingController not found for module Users.'
    );
  });

  it('covers controller-not-found fallback after module resolution errors', () => {
    expect.hasAssertions();
    expect(() => (RealtimeAPIBase as any).getControllerModule('Users', 'MissingController')).toThrow(
      'Controller MissingController not found for module Users.'
    );
  });
});

/**
 * What the runtime handler carries from the request into the domain event
 * (JUM-681).
 *
 * The suite above invokes the handler with an operation id and an input, which
 * is the shortest request a client can send. A real one carries an
 * authorization header, path params, a query string and correlation metadata,
 * and every one of those reaches the controller through a `|| {}` that the
 * short request never exercises.
 *
 * Dropping any of them is silent: the controller receives a domain event whose
 * `authorization` is `''` and answers 401 for an authenticated caller, or whose
 * `params` are empty and answers 404 for a record that exists. The event is
 * built correctly either way — it is the copy from the request that fails.
 */
describe('realtime runtime handler request mapping (JUM-681)', () => {
  const databaseClient = {
    connect: jest.fn(),
    disconnect: jest.fn()
  } as any;

  const handlerFor = (controller: Record<string, any>) => {
    const api = new TestRealtimeAPI({
      databaseClient,
      interfaceType: 'websocketapi',
      frameworkName: 'socket-io'
    });

    return (api as any).getRuntimeHandlerFactory({
      moduleName: 'Users',
      operationId: 'login',
      controllerMethod: 'login',
      controller,
      endPointConfig: { operationId: 'login', security: [{ bearerAuth: [] }] }
    });
  };

  it('carries authorization, params, query string and metadata into the event', async () => {
    expect.hasAssertions();

    const login = jest.fn().mockResolvedValue({ result: { ok: true } });
    const handler = handlerFor({ login });

    const response = await handler({
      operationId: 'login',
      authorization: 'Bearer token-1',
      input: { username: 'john' },
      params: { id: 'user-1' },
      queryString: { verbose: 'true' },
      metadata: { correlationId: 'corr-1' }
    });

    const [event] = login.mock.calls[0];
    expect(event.authorization).toBe('Bearer token-1');
    expect(event.input).toStrictEqual({ username: 'john' });
    expect(event.params).toStrictEqual({ id: 'user-1' });
    expect(event.queryString).toStrictEqual({ verbose: 'true' });
    expect(response.metadata).toMatchObject({ correlationId: 'corr-1' });
  });

  it('answers ok with no result when the controller returns nothing', async () => {
    expect.hasAssertions();

    // A controller that resolves `undefined` is not an error — some operations
    // acknowledge rather than return — and reading `.result` off it must not
    // throw on the way out.
    const handler = handlerFor({ login: jest.fn().mockResolvedValue(undefined) });

    const response = await handler({ operationId: 'login' });

    expect(response.ok).toBe(true);
    expect(response.result).toBeUndefined();
  });
});
