/* global  describe, it, expect */

import request from 'supertest';

import JwtService from '@src/infra/jwt/JwtService';
import MutexService from '@src/infra/mutex/adapter/MutexService';
import InMemoryDbClient from '@src/infra/persistence/InMemoryDatabase/InMemoryDbClient';
import InMemoryKeyValueStorageClient from '@src/infra/persistence/KeyValueStorage/InMemoryKeyValueStorageClient';
import PasswordCryptoService from '@src/infra/security/PasswordCryptoService';
import infraHandlers from '@src/interface/HTTP/adapters/restify/handlers/infraHandlers';
import RestifyServer from '@src/interface/HTTP/adapters/restify/RestifyServer';
import { EHTTPFrameworks } from '@src/interface/HTTP/ports';
import { RestAPI } from '@src/interface/HTTP/RestAPI';
import { UserDataRepository, UserService } from '@src/modules/Users';
import AuthService from '@src/modules/Users/service/AuthService';
import UserProviderLocal from '@src/modules/Users/service/UserProviderLocal';
import { listenForSupertest } from '@test/helpers/listenForSupertest';
import { BasicAuthorizationHeaderUser1 } from '@test/mock';

import type { Server as Restify } from 'restify';

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
const serverType = EHTTPFrameworks.restify;
const webServer = RestifyServer.compile();

let API: RestAPI<Restify>;
let server: any;

/**
 * JUM-663 — this suite used to build the API at module scope and request `/`
 * with a Basic header, having connected nothing, seeded nobody and never
 * waited for the server to listen. It answered 401 on CI:
 *
 *   ● restify -> /localhost suite › localhost should return 200
 *     Expected: 200
 *     Received: 401
 *
 * A test that sends credentials for a user it never created depends on state
 * it does not establish, and the fact that it usually passed is what made that
 * invisible. Its sibling `get.apiVersions.test.ts` already does all three.
 */
describe('restify -> /localhost suite', () => {
  beforeAll(async () => {
    await InMemoryDbClient.connect();
    await keyValueStorageClient.connect();
    API = new RestAPI<Restify>({
      databaseClient: InMemoryDbClient,
      webServer,
      infraHandlers,
      serverType,
      authService,
      passwordCryptoService,
      keyValueStorageClient,
      mutexService
    });
    server = API.server.application;
    await listenForSupertest(server);
    // The request below authenticates as user1, so user1 has to exist.
    await API.seedUsers();
  });

  afterAll(async () => {
    await API.stop();
  });

  it('localhost should return 200', async () => {
    expect.hasAssertions();
    const response = await request(server)
      .get('/')
      .set('Accept', 'application/json')
      .set(BasicAuthorizationHeaderUser1);
    expect(response.statusCode).toBe(200);
  });
});
