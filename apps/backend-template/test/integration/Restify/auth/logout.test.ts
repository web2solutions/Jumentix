/* global  describe, it, expect */
// file deepcode ignore NoHardcodedPasswords: <mocked passwords>
// file deepcode ignore NoHardcodedCredentials/test: <fake credential>
import request from 'supertest';

import createdUsers from '@seed/users';
import JwtService from '@src/infra/jwt/JwtService';
import MutexService from '@src/infra/mutex/adapter/MutexService';
import InMemoryDbClient from '@src/infra/persistence/InMemoryDatabase/InMemoryDbClient';
import InMemoryKeyValueStorageClient from '@src/infra/persistence/KeyValueStorage/InMemoryKeyValueStorageClient';
import PasswordCryptoService from '@src/infra/security/PasswordCryptoService';
import infraHandlers from '@src/interface/HTTP/adapters/restify/handlers/infraHandlers';
import RestifyServer from '@src/interface/HTTP/adapters/restify/RestifyServer';
import { EHTTPFrameworks } from '@src/interface/HTTP/ports';
import { RestAPI } from '@src/interface/HTTP/RestAPI';
import {
  AuthService,
  EAuthSchemaType,
  UserDataRepository,
  UserProviderLocal,
  UserService
} from '@src/modules/Users';

import { listenForSupertest } from '../../../helpers/listenForSupertest';

import type { Server as Restify } from 'restify';

const [createdUser1] = createdUsers;

const webServer = RestifyServer.compile();
const databaseClient = InMemoryDbClient;
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

let API: RestAPI<Restify>;
let server: any;

const requireAuthResult = <T>(result: T | undefined): T => {
  if (!result) {
    throw new Error('Expected authenticate to return a result.');
  }
  return result;
};

describe('restify -> logout suite', () => {
  beforeAll(async () => {
    await databaseClient.connect();
    await keyValueStorageClient.connect();

    API = new RestAPI<Restify>({
      databaseClient,
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

    await API.seedData();
  });

  afterAll(async () => {
    await databaseClient.disconnect();
    await keyValueStorageClient.disconnect();
    await server.close();
  });

  // eslint-disable-next-line jest/require-hook
  createdUsers.forEach((user, index) => {
    it(`user${index + 1} must be able to logout`, async () => {
      expect.hasAssertions();
      const { username, password } = user;
      const authResponse = await authService.authenticate(
        username,
        password,
        EAuthSchemaType.Bearer
      );
      const { result } = authResponse;
      const token = requireAuthResult(result).Authorization;
      const response = await request(server)
        .post('/api/1.0.0/auth/logout')
        .send({ username })
        .set('Content-Type', 'application/json; charset=utf-8')
        .set('Accept', 'application/json; charset=utf-8')
        .set({ Authorization: token });
      expect(response.statusCode).toBe(200);
      expect(response.body).toBeTruthy();
    });

    it(`user${index + 1} must be able to logout with a Basic token`, async () => {
      expect.hasAssertions();
      const { username, password } = user;
      const authResponse = await authService.authenticate(
        username,
        password,
        EAuthSchemaType.Basic
      );
      const { result } = authResponse;
      const token = requireAuthResult(result).Authorization;
      const response = await request(server)
        .post('/api/1.0.0/auth/logout')
        .send({ username })
        .set('Content-Type', 'application/json; charset=utf-8')
        .set('Accept', 'application/json; charset=utf-8')
        .set({ Authorization: token });
      expect(response.statusCode).toBe(200);
      expect(response.body).toBeTruthy();
    });
  });

  it('invalid token must return 401', async () => {
    expect.hasAssertions();
    const { username, password } = createdUser1;
    await authService.authenticate(username, password, EAuthSchemaType.Bearer);
    const response = await request(server)
      .post('/api/1.0.0/auth/logout')
      .send({ username })
      .set('Content-Type', 'application/json; charset=utf-8')
      .set('Accept', 'application/json; charset=utf-8')
      .set({ Authorization: '' });
    expect(response.statusCode).toBe(401);
    expect(response.body).toHaveProperty('error');
    expect(response.body.message).toBe('Unauthorized - invalid token');
  });

  it('invalid username must return 400', async () => {
    expect.hasAssertions();
    const { username, password } = createdUser1;
    const authResponse = await authService.authenticate(username, password, EAuthSchemaType.Bearer);
    const { result } = authResponse;
    const token = requireAuthResult(result).Authorization;
    const response = await request(server)
      .post('/api/1.0.0/auth/logout')
      .send({ username: 'XXXXXX' })
      .set('Content-Type', 'application/json; charset=utf-8')
      .set('Accept', 'application/json; charset=utf-8')
      .set({ Authorization: token });
    expect(response.statusCode).toBe(400);
    expect(response.body).toHaveProperty('error');
    expect(response.body.message).toBe('Bad Request - Invalid request');
  });

  it('undefined username must return 400', async () => {
    expect.hasAssertions();
    const { username, password } = createdUser1;
    const authResponse = await authService.authenticate(username, password, EAuthSchemaType.Bearer);
    const { result } = authResponse;
    const token = requireAuthResult(result).Authorization;
    const response = await request(server)
      .post('/api/1.0.0/auth/logout')
      .send({})
      .set('Content-Type', 'application/json; charset=utf-8')
      .set('Accept', 'application/json; charset=utf-8')
      .set({ Authorization: token });
    expect(response.statusCode).toBe(400);
    expect(response.body).toHaveProperty('error');
    expect(response.body.message).toBe('Bad Request - The property username is required.');
  });

  it('non-existing fields must return 400', async () => {
    expect.hasAssertions();
    const { username, password } = createdUser1;
    const authResponse = await authService.authenticate(username, password, EAuthSchemaType.Bearer);
    const { result } = authResponse;
    const token = requireAuthResult(result).Authorization;
    const response = await request(server)
      .post('/api/1.0.0/auth/logout')
      .send({ usernames: username, password })
      .set('Content-Type', 'application/json; charset=utf-8')
      .set('Accept', 'application/json; charset=utf-8')
      .set({ Authorization: token });
    expect(response.statusCode).toBe(400);
    expect(response.body).toHaveProperty('error');
    expect(response.body.message).toBe(
      'Bad Request - The property usernames from input payload does not exist.'
    );
  });
});
