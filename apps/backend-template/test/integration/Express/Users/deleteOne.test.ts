/* global  describe, it, expect */
import request from 'supertest';

import JwtService from '@src/infra/jwt/JwtService';
import MutexService from '@src/infra/mutex/adapter/MutexService';
import InMemoryDbClient from '@src/infra/persistence/InMemoryDatabase/InMemoryDbClient';
import InMemoryKeyValueStorageClient from '@src/infra/persistence/KeyValueStorage/InMemoryKeyValueStorageClient';
import PasswordCryptoService from '@src/infra/security/PasswordCryptoService';
import ExpressServer from '@src/interface/HTTP/adapters/express/ExpressServer';
import infraHandlers from '@src/interface/HTTP/adapters/express/handlers/infraHandlers';
import { EHTTPFrameworks } from '@src/interface/HTTP/ports';
import { RestAPI } from '@src/interface/HTTP/RestAPI';
import { UserDataRepository, UserService } from '@src/modules/Users';
import AuthService from '@src/modules/Users/service/AuthService';
import UserProviderLocal from '@src/modules/Users/service/UserProviderLocal';
import {
  BasicAuthorizationHeaderUser1,
  BasicAuthorizationHeaderUser2,
  BasicAuthorizationHeaderUser3,
  BasicAuthorizationHeaderUser4,
  BasicAuthorizationHeaderUserGuest
} from '@test/mock';

import closeServer from '../closeServer';

import type { Express } from 'express';

import type { IUser } from '@src/modules/Users/';

const webServer = ExpressServer.compile();
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

const serverType = EHTTPFrameworks.express;

let API: any;
let server: any;

describe('express -> delete User suite', () => {
  let usersAll: IUser[];
  beforeAll(async () => {
    await databaseClient.connect();
    await keyValueStorageClient.connect();
    API = new RestAPI<Express>({
      databaseClient,
      webServer,
      infraHandlers,
      serverType,
      authService,
      passwordCryptoService,
      keyValueStorageClient,
      mutexService
    });

    server = API.server.application.listen(0);

    // await server.ready();
    usersAll = await API.seedUsers();
  });
  afterAll(async () => {
    await databaseClient.disconnect();
    await keyValueStorageClient.disconnect();
    await closeServer(server);
  });

  it('user1 must be able to delete an user - user data 1', async () => {
    expect.hasAssertions();
    const response = await request(server)
      .delete(`/api/1.0.0/users/${usersAll[0].id}`)
      .set('Content-Type', 'application/json; charset=utf-8')
      .set('Accept', 'application/json; charset=utf-8')
      .set(BasicAuthorizationHeaderUser1);
    expect(response.body).toBeTruthy();
    expect(response.statusCode).toBe(200);
  });

  it('user2 must not be able to delete new user - Forbidden: the role delete_user is required', async () => {
    expect.hasAssertions();
    const response = await request(server)
      .delete(`/api/1.0.0/users/${usersAll[0].id}`)
      .set('Content-Type', 'application/json; charset=utf-8')
      .set('Accept', 'application/json; charset=utf-8')
      .set(BasicAuthorizationHeaderUser2);
    expect(response.statusCode).toBe(403);
    expect(response.body.message).toBe(
      'Forbidden - Insufficient permission - user must have the delete_user role'
    );
  });

  it('user3 must not be able to delete new user - Forbidden: the role delete_user is required', async () => {
    expect.hasAssertions();
    const response = await request(server)
      .delete(`/api/1.0.0/users/${usersAll[0].id}`)
      .set('Content-Type', 'application/json; charset=utf-8')
      .set('Accept', 'application/json; charset=utf-8')
      .set(BasicAuthorizationHeaderUser3);
    expect(response.statusCode).toBe(403);
    expect(response.body.message).toBe(
      'Forbidden - Insufficient permission - user must have the delete_user role'
    );
  });

  it('user4 must not be able to delete new user - Forbidden: the role delete_user is required', async () => {
    expect.hasAssertions();
    const response = await request(server)
      .delete(`/api/1.0.0/users/${usersAll[0].id}`)
      .set('Content-Type', 'application/json; charset=utf-8')
      .set('Accept', 'application/json; charset=utf-8')
      .set(BasicAuthorizationHeaderUser4);
    expect(response.statusCode).toBe(403);
    expect(response.body.message).toBe(
      'Forbidden - Insufficient permission - user must have the delete_user role'
    );
  });

  it('guest must not be able to delete new user - Unauthorized', async () => {
    expect.hasAssertions();
    const response = await request(server)
      .delete(`/api/1.0.0/users/${usersAll[0].id}`)
      .set('Content-Type', 'application/json; charset=utf-8')
      .set('Accept', 'application/json; charset=utf-8')
      .set(BasicAuthorizationHeaderUserGuest);
    expect(response.statusCode).toBe(401);
    expect(response.body.message).toBe('Unauthorized - user not found');
  });
});
