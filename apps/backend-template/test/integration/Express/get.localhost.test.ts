/* global describe, it, expect, beforeAll, afterAll */
import request from 'supertest';
import { Express } from 'express';
import { ExpressServer } from '@src/interface/HTTP/adapters/express/ExpressServer';
import { infraHandlers } from '@src/interface/HTTP/adapters/express/handlers/infraHandlers';
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
import { closeServer } from './closeServer';

/**
 * JUM-678 — this suite lives in `test/integration/Express/`, and now integrates.
 *
 * It used to call `localhostGetHandlerFactory({}).handler({}, fakeResponse)`
 * directly and assert that `res.json` had been called with the payload. That
 * assertion was real — it checked the body, not merely the call — but it went
 * nowhere near Express. The router, the CORS layer, helmet, the body parser and
 * the correlation-id middleware could all have been broken and this file would
 * have stayed green, under a directory whose name is a claim that they were
 * exercised.
 *
 * It issues a real request now. The correlation id is asserted as *a* UUID
 * rather than a fixed string, because the middleware mints it per request —
 * pinning a literal here would only pin the test's own fake.
 */
const webServer = ExpressServer.compile();
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

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

let API: RestAPI<Express>;
let server: any;

describe('express -> /localhost suite', () => {
  beforeAll(async () => {
    await InMemoryDbClient.connect();
    await keyValueStorageClient.connect();
    API = new RestAPI<Express>({
      databaseClient: InMemoryDbClient,
      webServer,
      infraHandlers,
      serverType: EHTTPFrameworks.express,
      authService,
      passwordCryptoService,
      keyValueStorageClient,
      mutexService
    });
    server = API.server.application.listen(0);
  });

  afterAll(async () => {
    await closeServer(server);
    await InMemoryDbClient.disconnect();
    await keyValueStorageClient.disconnect();
  });

  it('answers the root route through the Express stack', async () => {
    expect.hasAssertions();

    const response = await request(server)
      .get('/')
      .set('Accept', 'application/json');

    expect(response.statusCode).toBe(200);
    expect(response.body.status).toBe('result');
    // Minted by the correlation middleware, which the old form never ran.
    expect(response.body.correlationId).toMatch(UUID_V4);
  });

  it('gives each request its own correlation id', async () => {
    expect.hasAssertions();

    // The middleware's actual job. Asserting one id proves it produced a
    // string; asserting two differ proves it produces one per request.
    const first = await request(server).get('/').set('Accept', 'application/json');
    const second = await request(server).get('/').set('Accept', 'application/json');

    expect(first.body.correlationId).not.toBe(second.body.correlationId);
  });
});
