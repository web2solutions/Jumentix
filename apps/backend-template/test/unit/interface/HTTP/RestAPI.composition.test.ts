/* eslint-disable @typescript-eslint/no-explicit-any, jest/max-expects */

import fs from 'fs';
import os from 'os';
import path from 'path';

import { RestAPI } from '@src/interface/HTTP/RestAPI';
import { EHTTPFrameworks } from '@src/interface/HTTP/ports';
import { infraHandlers } from '@src/interface/HTTP/adapters/express/handlers/infraHandlers';
import { PasswordCryptoService } from '@src/infra/security/PasswordCryptoService';
import { InMemoryKeyValueStorageClient } from '@src/infra/persistence/KeyValueStorage/InMemoryKeyValueStorageClient';
import { MutexService } from '@src/infra/mutex/adapter/MutexService';
import { JwtService } from '@src/infra/jwt/JwtService';
import { composeUsersAuthServices } from '@src/modules/Users';
import { InMemoryDbClient } from '@src/infra/persistence/InMemoryDatabase/InMemoryDbClient';

/**
 * Constructor wiring that only exists when a spec directory does not.
 *
 * `RestAPI.buildWithOAS` reads `./spec` relative to the process cwd, so these
 * suites chdir into a fixture directory per test. That is what lets the specs
 * be wrong on purpose — a spec without an `openapi` key, an AsyncAPI file
 * without an `asyncapi` key, a path outside the Users module — each a file a
 * real deployment can ship.
 */

const serverDouble = () => {
  const registered: any[] = [];
  const server = {
    endPointRegister: jest.fn((endpoint: any) => { registered.push(endpoint); }),
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn().mockResolvedValue(undefined)
  };
  return { server, registered };
};

const bareConfig = (server: any, overrides: Record<string, any> = {}) => ({
  databaseClient: InMemoryDbClient,
  webServer: server,
  infraHandlers,
  ...overrides
});

describe('restAPI composition with fixture spec directories', () => {
  let cwd: string;
  let tmp: string;

  afterEach(() => {
    process.chdir(cwd);
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  const chdirTo = (files: Record<string, string>) => {
    cwd = process.cwd();
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'restapi-spec-'));
    Object.entries(files).forEach(([name, content]) => {
      const target = path.join(tmp, name);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, content, 'utf8');
    });
    process.chdir(tmp);
  };

  it('skips non-spec files and specs without an openapi declaration', () => {
    expect.hasAssertions();

    chdirTo({
      'spec/notes.txt': 'not a spec',
      'spec/broken.yaml': 'foo: bar\n',
      'spec/empty.yml': 'openapi: 3.1.0\ninfo:\n  version: 9.9.9\npaths:\n  /null-path:\n',
      'spec/asyncapi/bad.yml': 'foo: bar\n',
      'spec/asyncapi/v2.yaml': 'asyncapi: 3.0.0\ninfo:\n  version: 2.0.0\n  title: fixture\n'
    });

    const { server, registered } = serverDouble();
    // eslint-disable-next-line no-new
    new RestAPI<any>(bareConfig(server));

    const paths = registered.map((endpoint) => endpoint.path);
    // The spec with a path that declares no operations still gets its docs
    // route, and the path itself registers nothing; the broken one gets
    // nothing at all.
    expect(paths).toContain('/docs/9.9.9');
    expect(paths).toContain('/docs/asyncapi/2.0.0');
    expect(paths.some((entry) => entry.includes('broken'))).toBe(false);
    expect(paths.some((entry) => entry.includes('bad'))).toBe(false);
    expect(paths.some((entry) => entry.includes('null-path'))).toBe(false);
  });

  it('registers endpoints for a module outside Users through the same pipeline', () => {
    expect.hasAssertions();

    chdirTo({
      'spec/1.0.0.yml': [
        'openapi: 3.1.0',
        'info:',
        '  version: 1.0.0',
        '  title: fixture',
        'paths:',
        '  /tasks:',
        '    post:',
        '      operationId: createTask'
      ].join('\n')
    });

    // Tasks is not a module this template ships; the controller and handler
    // lookups are doubled so the wiring itself is what runs.
    const controllerFactory = jest.fn().mockImplementation(() => ({}));
    const controllerSpy = jest
      .spyOn(RestAPI as any, 'getControllerModule')
      .mockReturnValue(controllerFactory);
    const handlerSpy = jest
      .spyOn(RestAPI.prototype as any, 'getHandlerFactory')
      .mockReturnValue({ method: 'post', path: '/tasks', handler: jest.fn() });

    const { server, registered } = serverDouble();
    // eslint-disable-next-line no-new
    new RestAPI<any>(bareConfig(server));

    expect(registered.map((endpoint) => endpoint.path)).toContain('/api/1.0.0/tasks');
    expect(controllerFactory).toHaveBeenCalledWith(expect.objectContaining({
      userService: undefined,
      authUseCases: undefined
    }));

    handlerSpy.mockRestore();
    controllerSpy.mockRestore();
  });

  it('treats a missing asyncapi directory and an asyncapi file as no async specs', () => {
    expect.hasAssertions();

    chdirTo({
      'spec/empty.yml': 'openapi: 3.1.0\ninfo:\n  version: 9.9.9\npaths: {}\n'
    });
    const withoutDir = serverDouble();
    // eslint-disable-next-line no-new
    new RestAPI<any>(bareConfig(withoutDir.server));
    expect(withoutDir.registered.map((endpoint) => endpoint.path))
      .toContain('/docs/asyncapi/versions');

    process.chdir(cwd);
    fs.rmSync(tmp, { recursive: true, force: true });

    // `spec/asyncapi` present but a regular file, not a directory.
    cwd = process.cwd();
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'restapi-spec-'));
    fs.mkdirSync(path.join(tmp, 'spec'));
    fs.writeFileSync(
      path.join(tmp, 'spec', 'empty.yml'),
      'openapi: 3.1.0\ninfo:\n  version: 9.9.9\npaths: {}\n',
      'utf8'
    );
    fs.writeFileSync(path.join(tmp, 'spec', 'asyncapi'), 'not a directory', 'utf8');
    process.chdir(tmp);

    const withFile = serverDouble();
    // eslint-disable-next-line no-new
    new RestAPI<any>(bareConfig(withFile.server));
    expect(withFile.registered.map((endpoint) => endpoint.path))
      .toContain('/docs/asyncapi/versions');
  });

  it('uses the message mediator as the event bus when both are configured', () => {
    expect.hasAssertions();

    chdirTo({ 'spec/empty.yml': 'openapi: 3.1.0\ninfo:\n  version: 9.9.9\npaths: {}\n' });

    const eventBus = { publish: jest.fn() };
    const messageMediator = { publish: jest.fn(), subscribe: jest.fn() };

    const both = serverDouble();
    const apiWithBoth = new RestAPI<any>(bareConfig(both.server, { eventBus, messageMediator }));
    expect((apiWithBoth as any).messageMediator).toBe(messageMediator);
    expect((apiWithBoth as any).eventBus).toBe(messageMediator);

    const onlyBus = serverDouble();
    const apiWithOnlyBus = new RestAPI<any>(bareConfig(onlyBus.server, { eventBus }));
    expect((apiWithOnlyBus as any).eventBus).toBe(eventBus);

    const neither = serverDouble();
    const apiWithNeither = new RestAPI<any>(bareConfig(neither.server));
    expect((apiWithNeither as any).eventBus).toBeUndefined();
    expect((apiWithNeither as any).serverType).toBe(EHTTPFrameworks.express);
  });

  it('fails composition with the name of each missing service, in order', () => {
    expect.hasAssertions();

    chdirTo({ 'spec/empty.yml': 'openapi: 3.1.0\ninfo:\n  version: 9.9.9\npaths: {}\n' });
    const { server } = serverDouble();
    const api = new RestAPI<any>(bareConfig(server)) as any;

    expect(() => api.composeUsersModule())
      .toThrow('PasswordCryptoService is required to compose Users module.');

    api.passwordCryptoService = PasswordCryptoService.compile();
    expect(() => api.composeUsersModule())
      .toThrow('MutexService is required to compose Users module.');

    api.mutexClient = MutexService.compile(InMemoryKeyValueStorageClient.compile());
    expect(() => api.composeUsersModule())
      .toThrow('AuthService with JwtService is required to compose Users module.');

    // An auth service without a JWT service fails the same guard.
    api.authService = {};
    expect(() => api.composeUsersModule())
      .toThrow('AuthService with JwtService is required to compose Users module.');

    const { authService } = composeUsersAuthServices({
      databaseClient: InMemoryDbClient,
      passwordCryptoService: api.passwordCryptoService,
      mutexService: api.mutexClient,
      jwtService: JwtService.compile()
    });
    api.authService = authService;

    const composition = api.composeUsersModule();
    expect(composition.userUseCases).toBeDefined();
    expect(api.composeUsersModule()).toBe(composition);
  });

  it('starts and stops cleanly without a key-value client or replay worker', async () => {
    expect.hasAssertions();

    chdirTo({ 'spec/empty.yml': 'openapi: 3.1.0\ninfo:\n  version: 9.9.9\npaths: {}\n' });

    const passwordCryptoService = PasswordCryptoService.compile();
    const mutexService = MutexService.compile(InMemoryKeyValueStorageClient.compile());
    const { authService } = composeUsersAuthServices({
      databaseClient: InMemoryDbClient,
      passwordCryptoService,
      mutexService,
      jwtService: JwtService.compile()
    });

    const { server } = serverDouble();
    const api = new RestAPI<any>(bareConfig(server, {
      passwordCryptoService,
      mutexService,
      authService
    }));

    await api.start();
    expect((api as any).started).toBe(true);
    // Without a shared store there is no queue and no worker to start.
    expect((api as any).usersComposition.deadLetterWorker).toBeUndefined();
    expect(server.start).toHaveBeenCalledTimes(1);

    await api.stop();
    expect(server.stop).toHaveBeenCalledTimes(1);
  });

  it('registers process hooks that stop the server on exit and fail on unhandled rejection', () => {
    expect.hasAssertions();

    chdirTo({ 'spec/empty.yml': 'openapi: 3.1.0\ninfo:\n  version: 9.9.9\npaths: {}\n' });

    const onSpy = jest.spyOn(process, 'on');
    const callsBefore = onSpy.mock.calls.length;
    const { server } = serverDouble();
    const api = new RestAPI<any>(bareConfig(server));
    const added = onSpy.mock.calls.slice(callsBefore);
    onSpy.mockRestore();

    const exitHandler = added.find(([event]) => event === 'exit')?.[1] as () => void;
    const rejectionHandler = added.find(([event]) => event === 'unhandledRejection')?.[1] as
      (error: unknown) => void;
    expect(exitHandler).toBeDefined();
    expect(rejectionHandler).toBeDefined();

    // Exiting the process stops the API instead of dropping connections.
    const stopSpy = jest.spyOn(api, 'stop').mockResolvedValue(undefined);
    exitHandler();
    expect(stopSpy).toHaveBeenCalledTimes(1);
    stopSpy.mockRestore();

    // An unhandled rejection is reported and terminates the process loudly.
    const errorLog = jest.spyOn(console, 'error').mockImplementation();
    const exitSpy = jest
      .spyOn(process, 'exit')
      .mockImplementation((() => undefined) as any);
    const failure = new Error('unhandled kaboom');
    rejectionHandler(failure);
    expect(errorLog).toHaveBeenCalledWith(failure);
    expect(exitSpy).toHaveBeenCalledWith(1);
    errorLog.mockRestore();
    exitSpy.mockRestore();
  });
});
