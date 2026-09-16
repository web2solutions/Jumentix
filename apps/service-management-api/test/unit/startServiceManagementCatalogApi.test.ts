/* eslint-disable jest/no-untyped-mock-factory */

const mockExpressServerInstance = { name: 'express-server' };
const mockBaseDatabaseClient = { name: 'base-database-client' };
const mockCatalogDatabaseClient = { name: 'catalog-database-client' };
const mockKeyValueDisconnect = jest.fn().mockResolvedValue(undefined);
const mockKeyValueStorageClient = { disconnect: mockKeyValueDisconnect };
const mockMessageMediator = { name: 'message-mediator' };
const mockAuthService = { name: 'auth-service' };
const mockCatalogStart = jest.fn().mockResolvedValue(undefined);
const mockCatalogStop = jest.fn().mockResolvedValue(undefined);
const mockCatalogApiInstance = { start: mockCatalogStart, stop: mockCatalogStop };
const mockApplyCatalogCorsDefaults = jest.fn();
const mockCompileAdapterRuntime = jest.fn((_config: Record<string, any>) => ({
  databaseClient: mockBaseDatabaseClient,
  keyValueStorageClient: mockKeyValueStorageClient,
  messageMediator: mockMessageMediator,
  authService: mockAuthService
}));
const mockCreateDbClient = jest.fn(() => mockCatalogDatabaseClient);
const mockExpressServer = jest.fn(() => mockExpressServerInstance);
const mockCatalogAPI = jest.fn(() => mockCatalogApiInstance);
const mockMutexCompile = jest.fn();
const mockPasswordCryptoCompile = jest.fn();
const mockJwtCompile = jest.fn();
const mockCompileMessageMediator = jest.fn();
const mockComposeUsersAuthServices = jest.fn();
const mockCompileDatabaseClient = jest.fn();
const mockCompileKeyValueStorageClient = jest.fn();

jest.mock('@src/interface/HTTP/adapters/express/ExpressServer', () => ({
  ExpressServer: mockExpressServer
}));

jest.mock('@src/modules/Users', () => ({
  composeUsersAuthServices: mockComposeUsersAuthServices
}));

jest.mock('@src/infra/mutex/adapter/MutexService', () => ({
  MutexService: { compile: mockMutexCompile }
}));

jest.mock('@src/infra/persistence/compileDatabaseClient', () => ({
  compileDatabaseClient: mockCompileDatabaseClient
}));

jest.mock('@src/infra/jwt/JwtService', () => ({
  JwtService: { compile: mockJwtCompile }
}));

jest.mock('@src/infra/persistence/KeyValueStorage/compileKeyValueStorageClient', () => ({
  compileKeyValueStorageClient: mockCompileKeyValueStorageClient
}));

jest.mock('@src/infra/security/PasswordCryptoService', () => ({
  PasswordCryptoService: { compile: mockPasswordCryptoCompile }
}));

jest.mock('@src/infra/messages/compileMessageMediator', () => ({
  compileMessageMediator: mockCompileMessageMediator
}));

jest.mock('@jumentix/adapter-runtime-bootstrap', () => ({
  compileAdapterRuntime: mockCompileAdapterRuntime
}));

jest.mock('@service-management-api/ServiceManagementCatalogAPI', () => ({
  ServiceManagementCatalogAPI: mockCatalogAPI
}));

jest.mock(
  '@service-management-api/infra/persistence/InMemoryDatabase/InMemoryCatalogDbClient',
  () => ({
    createServiceManagementCatalogDbClient: mockCreateDbClient,
    InMemoryCatalogDbClient: mockCatalogDatabaseClient
  })
);

jest.mock('@service-management-api/runtime/catalogCors', () => ({
  applyCatalogCorsDefaults: mockApplyCatalogCorsDefaults
}));

const flushAsync = () => new Promise((resolve) => { setImmediate(resolve); });

describe('start-service-management-catalog-api entrypoint', () => {
  const signalHandlers: Record<string, () => void> = {};
  let logSpy: jest.SpyInstance;
  let exitSpy: jest.SpyInstance;

  beforeAll(async () => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    exitSpy = jest.spyOn(process, 'exit').mockImplementation((() => undefined) as () => never);
    jest.spyOn(process, 'once').mockImplementation(((event: string, handler: () => void) => {
      signalHandlers[event] = handler;
      return process;
    }) as typeof process.once);
    await import('@service-management-api/start-service-management-catalog-api');
    await flushAsync();
  });

  afterAll(() => {
    logSpy.mockRestore();
    exitSpy.mockRestore();
    (process.once as jest.Mock).mockRestore();
  });

  it('applies the catalog CORS defaults and compiles the adapter runtime on boot', () => {
    expect.hasAssertions();
    expect(mockApplyCatalogCorsDefaults).toHaveBeenCalledTimes(1);
    expect(mockExpressServer).toHaveBeenCalledTimes(1);
    expect(mockCompileAdapterRuntime).toHaveBeenCalledTimes(1);
  });

  it('passes the backend compilers through to the adapter runtime config', () => {
    expect.hasAssertions();
    const runtimeConfig = mockCompileAdapterRuntime.mock.calls[0][0] as Record<string, unknown>;
    expect(runtimeConfig.compileDatabaseClient).toBe(mockCompileDatabaseClient);
    expect(runtimeConfig.compileKeyValueStorageClient).toBe(mockCompileKeyValueStorageClient);
    expect(runtimeConfig.composeAuthServices).toBe(mockComposeUsersAuthServices);
  });

  it('delegates the service compilers through the runtime config lambdas', () => {
    expect.hasAssertions();
    const runtimeConfig = mockCompileAdapterRuntime.mock.calls[0][0] as Record<string, any>;
    const connector = { name: 'connector' };
    runtimeConfig.compileMutexService(connector);
    runtimeConfig.compilePasswordCryptoService();
    runtimeConfig.compileJwtService();
    runtimeConfig.compileMessageMediator();
    expect(mockMutexCompile).toHaveBeenCalledWith(connector);
    expect(mockPasswordCryptoCompile).toHaveBeenCalledTimes(1);
    expect(mockJwtCompile).toHaveBeenCalledTimes(1);
    expect(mockCompileMessageMediator).toHaveBeenCalledTimes(1);
  });

  it('builds and starts the catalog API over the compiled runtime pieces', () => {
    expect.hasAssertions();
    expect(mockCreateDbClient).toHaveBeenCalledWith(mockBaseDatabaseClient);
    expect(mockCatalogAPI).toHaveBeenCalledWith(expect.objectContaining({
      databaseClient: mockCatalogDatabaseClient,
      webServer: mockExpressServerInstance,
      authService: mockAuthService,
      eventBus: mockMessageMediator,
      messageMediator: mockMessageMediator
    }));
    expect(mockCatalogStart).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith('Service Management catalog API started.');
  });

  it('stops the API and disconnects storage on SIGTERM before exiting', async () => {
    expect.hasAssertions();
    expect(typeof signalHandlers.SIGTERM).toBe('function');
    signalHandlers.SIGTERM();
    await flushAsync();
    expect(mockCatalogStop).toHaveBeenCalledTimes(1);
    expect(mockKeyValueDisconnect).toHaveBeenCalledTimes(1);
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('stops the API and disconnects storage on SIGINT before exiting', async () => {
    expect.hasAssertions();
    expect(typeof signalHandlers.SIGINT).toBe('function');
    signalHandlers.SIGINT();
    await flushAsync();
    expect(mockCatalogStop).toHaveBeenCalledTimes(2);
    expect(mockKeyValueDisconnect).toHaveBeenCalledTimes(2);
  });
});
