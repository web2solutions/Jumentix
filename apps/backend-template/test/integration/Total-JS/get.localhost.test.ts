/* global describe, it, expect, beforeAll, afterAll */
import type { Server } from 'node:http';
import request from 'supertest';
import { TotalJsServer } from '@src/interface/HTTP/adapters/total-js/TotalJsServer';
import { infraHandlers } from '@src/interface/HTTP/adapters/total-js/handlers/infraHandlers';
import { RestAPI } from '@src/interface/HTTP/RestAPI';
import { InMemoryDbClient } from '@src/infra/persistence/InMemoryDatabase/InMemoryDbClient';
import { InMemoryKeyValueStorageClient } from '@src/infra/persistence/KeyValueStorage/InMemoryKeyValueStorageClient';
import { MutexService } from '@src/infra/mutex/adapter/MutexService';
import { PasswordCryptoService } from '@src/infra/security/PasswordCryptoService';
import { JwtService } from '@src/infra/jwt/JwtService';
import { AuthService } from '@src/modules/Users/service/AuthService';
import { UserProviderLocal } from '@src/modules/Users/service/UserProviderLocal';
import { UserDataRepository, UserService } from '@src/modules/Users';
import { EHTTPFrameworks } from '@src/interface/HTTP/ports';
import {
  closeSupertestServer,
  createSupertestServer,
  supertestServerUrl
} from '@test/helpers/listenForSupertest';

/**
 * JUM-698 — this suite lives in `test/integration/Total-JS/`, and now
 * integrates.
 *
 * It used to call `localhostGetHandlerFactory({}).handler({}, fakeResponse)`
 * and assert the payload passed to `res.json`. The assertion was real; the
 * claim the directory makes was not. The router never ran, and neither did the
 * request context — which is how a defect this suite existed to catch survived:
 * the adapter established no correlation store, so **every request through it
 * answered 500**, and the test hid that by calling `Context.run` itself.
 *
 * It issues a real request now, against the listener `start` binds. The
 * correlation id is asserted as *a* UUID rather than a fixed string, because
 * the adapter mints it per request — pinning a literal would pin the test's own
 * input again.
 */
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const webServer = TotalJsServer.compile() as TotalJsServer;
const passwordCryptoService = PasswordCryptoService.compile();
const jwtService = JwtService.compile();
const keyValueStorageClient = InMemoryKeyValueStorageClient.compile();
const mutexService = MutexService.compile(keyValueStorageClient);

const dataRepository = UserDataRepository.compile({ databaseClient: InMemoryDbClient });
const userService = UserService.compile({
  dataRepository,
  services: { passwordCryptoService, mutexService }
});
const authService = AuthService.compile(
  UserProviderLocal.compile(userService),
  passwordCryptoService,
  jwtService
);

let listener: (req: unknown, res: unknown) => void;
let server: Server;
let serverUrl: string;

describe('total-js -> /localhost suite', () => {
  beforeAll(async () => {
    await InMemoryDbClient.connect();
    await keyValueStorageClient.connect();
    // eslint-disable-next-line no-new
    new RestAPI<any>({
      databaseClient: InMemoryDbClient,
      webServer,
      infraHandlers,
      serverType: EHTTPFrameworks.total_js,
      authService,
      passwordCryptoService,
      keyValueStorageClient,
      mutexService
    });
    listener = webServer.requestListener();
    server = await createSupertestServer(listener as never);
    serverUrl = supertestServerUrl(server);
  });

  afterAll(async () => {
    await closeSupertestServer(server);
    await InMemoryDbClient.disconnect();
    await keyValueStorageClient.disconnect();
  });

  it('answers the root route through the adapter router', async () => {
    expect.hasAssertions();

    const response = await request(serverUrl)
      .get('/')
      .set('Accept', 'application/json');

    expect(response.statusCode).toBe(200);
    expect(response.body.status).toBe('result');
    expect(response.body.correlationId).toMatch(UUID_V4);
  });

  it('gives each request its own correlation id', async () => {
    expect.hasAssertions();

    // Asserting one id proves the adapter produced a string; asserting two
    // differ proves it produces one per request.
    const first = await request(serverUrl).get('/').set('Accept', 'application/json');
    const second = await request(serverUrl).get('/').set('Accept', 'application/json');

    expect(first.body.correlationId).not.toBe(second.body.correlationId);
  });
});
