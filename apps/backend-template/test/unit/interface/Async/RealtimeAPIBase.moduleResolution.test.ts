/* eslint-disable @typescript-eslint/no-explicit-any */

import { RealtimeAPIBase } from '@src/interface/Async/RealtimeAPIBase';
import { PasswordCryptoService } from '@src/infra/security/PasswordCryptoService';
import { InMemoryKeyValueStorageClient } from '@src/infra/persistence/KeyValueStorage/InMemoryKeyValueStorageClient';
import { MutexService } from '@src/infra/mutex/adapter/MutexService';
import { JwtService } from '@src/infra/jwt/JwtService';
import { composeUsersAuthServices } from '@src/modules/Users';
import { InMemoryDbClient } from '@src/infra/persistence/InMemoryDatabase/InMemoryDbClient';

/**
 * The resolver's answer when the module loads but is not a handler factory.
 *
 * Jest cannot virtual-mock a path that only exists through `moduleNameMapper`,
 * so these substitute real handler modules this suite never invokes for their
 * declared operation. What is asserted is the resolver's behaviour: a loaded
 * module whose default is not a factory is "no handler", and a framework that
 * forwards the bare request reaches the `invoke` fallback the websocket
 * wrapper normally hides.
 */

jest.mock(
  '@src/modules/Users/interface/websocketapi/frameworks/socket-io/handlers/login',
  // No `__esModule` marker: bun's require unwraps marked mocks to the default
  // value itself, while jest returns the factory result verbatim. The bare
  // `{ default }` shape is what both runners hand to the resolver.
  () => ({ default: 42 })
);

jest.mock(
  '@src/modules/Users/interface/websocketapi/frameworks/socket-io/handlers/register',
  // The framework module receives the deps and hands back the raw invoke, so
  // the test can drive it without the websocket response wrapper.
  () => ({ default: ({ invoke }: any) => invoke })
);

class ProbeAPI extends RealtimeAPIBase {}

const databaseClient = {
  connect: jest.fn(),
  disconnect: jest.fn()
} as any;

describe('realtime api base module resolution edge cases', () => {
  it('builds operations from the real spec when autoBuild keeps its default', () => {
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

    const api = new ProbeAPI({
      databaseClient: InMemoryDbClient,
      passwordCryptoService,
      mutexService,
      authService
    });

    expect((api as any).listOperationIds()).toStrictEqual(expect.arrayContaining(['login', 'getAll']));
  });

  it('answers undefined when the runtime module default is not a factory', () => {
    expect.hasAssertions();

    const api = new ProbeAPI({
      databaseClient,
      interfaceType: 'websocketapi',
      frameworkName: 'socket-io'
    }, false);

    const handler = (api as any).getRuntimeHandlerFactory({
      moduleName: 'Users',
      operationId: 'login',
      controllerMethod: 'login',
      controller: {},
      endPointConfig: {}
    });

    expect(handler).toBeUndefined();
  });

  it('answers empty metadata when a bare invoke request carries none', async () => {
    expect.hasAssertions();

    // The websocket wrapper always decorates metadata before invoking; a
    // framework that hands the request straight through (as this double does)
    // exercises the `|| {}` the wrapper hides.
    const api = new ProbeAPI({
      databaseClient,
      interfaceType: 'websocketapi',
      frameworkName: 'socket-io'
    }, false);
    const register = jest.fn().mockResolvedValue({ result: 'pong' });

    const invoke = (api as any).getRuntimeHandlerFactory({
      moduleName: 'Users',
      operationId: 'register',
      controllerMethod: 'register',
      controller: { register },
      endPointConfig: { operationId: 'register' }
    });

    const response = await invoke({ operationId: 'register' });

    expect(response).toStrictEqual({
      ok: true,
      operationId: 'register',
      metadata: {},
      result: 'pong'
    });
  });
});
