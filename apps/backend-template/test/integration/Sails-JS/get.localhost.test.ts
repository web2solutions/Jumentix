/* global describe, it, expect, beforeAll, afterAll */
import request from 'supertest';
import { SailsJsServer } from '@src/interface/HTTP/adapters/sails-js/SailsJsServer';
import { infraHandlers } from '@src/interface/HTTP/adapters/sails-js/handlers/infraHandlers';
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

/**
 * JUM-704 — this suite lives in `test/integration/Sails-JS/`, and now
 * integrates.
 *
 * It used to call the handler directly with a fake response, and it could not
 * have done otherwise: `sails` was not a dependency of this repository, so the
 * server class could not be constructed at all.
 *
 * Sails is the one adapter here with no in-process request path — it lifts a
 * real runtime and binds a socket. So this binds an **ephemeral** port rather
 * than the configured one: a suite that takes `_HTTP_PORT_` fails whenever
 * anything else on the machine holds it, which is Requirement 134 §1.
 */
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const webServer = SailsJsServer.compile() as SailsJsServer;
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

/** An ephemeral port the runtime is asked to bind, resolved before lift. */
const testPort = 30000 + Math.floor(Math.random() * 20000);
const baseUrl = `http://127.0.0.1:${String(testPort)}`;

describe('sails-js -> /localhost suite', () => {
  beforeAll(async () => {
    await InMemoryDbClient.connect();
    await keyValueStorageClient.connect();
    // eslint-disable-next-line no-new
    new RestAPI<any>({
      databaseClient: InMemoryDbClient,
      webServer,
      infraHandlers,
      serverType: EHTTPFrameworks.sails_js,
      authService,
      passwordCryptoService,
      keyValueStorageClient,
      mutexService
    });
    await webServer.start(testPort);
  }, 120000);

  afterAll(async () => {
    await webServer.stop();
    await InMemoryDbClient.disconnect();
    await keyValueStorageClient.disconnect();
  }, 120000);

  it('answers the root route through the lifted runtime', async () => {
    expect.hasAssertions();

    const response = await request(baseUrl)
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
    const first = await request(baseUrl).get('/').set('Accept', 'application/json');
    const second = await request(baseUrl).get('/').set('Accept', 'application/json');

    expect(first.body.correlationId).not.toBe(second.body.correlationId);
  });
});
