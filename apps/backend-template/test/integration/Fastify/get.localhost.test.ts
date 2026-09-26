/* global  describe, it, expect */
import request from 'supertest';

import JwtService from '@src/infra/jwt/JwtService';
import MutexService from '@src/infra/mutex/adapter/MutexService';
import InMemoryDbClient from '@src/infra/persistence/InMemoryDatabase/InMemoryDbClient';
import InMemoryKeyValueStorageClient from '@src/infra/persistence/KeyValueStorage/InMemoryKeyValueStorageClient';
import PasswordCryptoService from '@src/infra/security/PasswordCryptoService';
import { FastifyServer } from '@src/interface/HTTP/adapters/fastify/FastifyServer';
import infraHandlers from '@src/interface/HTTP/adapters/fastify/handlers/infraHandlers';
import { EHTTPFrameworks } from '@src/interface/HTTP/ports';
import { RestAPI } from '@src/interface/HTTP/RestAPI';
import { UserDataRepository, UserService } from '@src/modules/Users';
import AuthService from '@src/modules/Users/service/AuthService';
import UserProviderLocal from '@src/modules/Users/service/UserProviderLocal';
import { BasicAuthorizationHeaderUser1 } from '@test/mock';

import type { Fastify } from '@src/interface/HTTP/adapters/fastify/FastifyServer';

const passwordCryptoService = PasswordCryptoService.compile();
const jwtService = JwtService.compile();
const keyValueStorageClient = InMemoryKeyValueStorageClient.compile();
const mutexService = MutexService.compile(keyValueStorageClient);

// LOCAL IDENTITY PROVIDER
const dataRepository = UserDataRepository.compile({
  databaseClient: InMemoryDbClient
});
const userService = UserService.compile({
  dataRepository,
  services: {
    passwordCryptoService,
    mutexService
  }
});
const userProvider = UserProviderLocal.compile(userService);
const authService = AuthService.compile(userProvider, passwordCryptoService, jwtService);
// LOCAL IDENTITY PROVIDER
const serverType = EHTTPFrameworks.fastify;
const webServer = FastifyServer.compile();
const API: RestAPI<Fastify> = new RestAPI<Fastify>({
  databaseClient: InMemoryDbClient,
  webServer,
  infraHandlers,
  serverType,
  authService,
  passwordCryptoService,
  keyValueStorageClient,
  mutexService
});

const { application } = API.server;

/**
 * JUM-663 — the request below authenticates as user1, so user1 has to exist.
 *
 * The Restify twin of this suite answered 401 on CI for exactly that reason:
 * it presented credentials for a user nothing had created. This one waits for
 * the server, which the Restify one did not, but it seeded nobody either.
 */
describe('/localhost suite', () => {
  beforeAll(async () => {
    await InMemoryDbClient.connect();
    await keyValueStorageClient.connect();
    await application.ready();
    await application.listen({ port: 0, host: '127.0.0.1' });
    await API.seedUsers();
  });
  afterAll(async () => {
    await application.close();
  });

  it('fastify -> localhost should return 200', async () => {
    expect.hasAssertions();
    const response = await request(application.server)
      .get('/')
      .set('Accept', 'application/json; charset=utf-8')
      .set(BasicAuthorizationHeaderUser1);
    expect(response.statusCode).toBe(200);
  });
});
