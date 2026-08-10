/* eslint-disable no-param-reassign */
/* global  describe, it, expect */
// file deepcode ignore NoHardcodedPasswords: <mocked passwords>
// file deepcode ignore NoHardcodedCredentials/test: <fake credential>
import request from 'supertest';
import { Express } from 'express';
import { ExpressServer } from '@src/interface/HTTP/adapters/express/ExpressServer';
import { infraHandlers } from '@src/interface/HTTP/adapters/express/handlers/infraHandlers';

import { EHTTPFrameworks } from '@src/interface/HTTP/ports';
import { InMemoryDbClient } from '@src/infra/persistence/InMemoryDatabase/InMemoryDbClient';
import { InMemoryKeyValueStorageClient } from '@src/infra/persistence/KeyValueStorage/InMemoryKeyValueStorageClient';
import { MutexService } from '@src/infra/mutex/adapter/MutexService';
import { PasswordCryptoService } from '@src/infra/security/PasswordCryptoService';
import { JwtService } from '@src/infra/jwt/JwtService';
import { RestAPI } from '@src/interface/HTTP/RestAPI';
import {
  UserDataRepository, UserService, UserProviderLocal, AuthService
} from '@src/modules/Users';

import users from '@seed/users';

const [user1] = users;

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

const authService = AuthService.compile(
  userProvider,
  passwordCryptoService,
  jwtService
);
// LOCAL IDENTITY PROVIDER

const serverType = EHTTPFrameworks.express;

let API: RestAPI<Express>;
let server: any;

const registerPayload = (user: typeof user1, username = user.username) => {
  const payload = { ...user, username };
  delete (payload as any).lastName;
  delete (payload as any).id;
  delete (payload as any).emails;
  delete (payload as any).avatar;
  delete (payload as any).roles;
  delete (payload as any).organization;
  delete (payload as any).documents;
  delete (payload as any).phones;
  return payload;
};

describe('express -> register suite', () => {
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

    server = API.server.application;

    // await API.seedData();
  });

  afterAll(async () => {
    await databaseClient.disconnect();
    await keyValueStorageClient.disconnect();
    // await keyValueStorageClient.disconnect();
  });

  // eslint-disable-next-line jest/require-hook
  users.forEach((user, index) => {
    it(`user${index + 1} must be able to register`, async () => {
      expect.hasAssertions();
      const newUser = registerPayload(user);
      const response = await request(server)
        .post('/api/1.0.0/auth/register')
        .send(newUser)
        .set('Content-Type', 'application/json; charset=utf-8')
        .set('Accept', 'application/json; charset=utf-8');
      expect(response.statusCode).toBe(201);
      expect(response.body.username).toBe(newUser.username);
      expect(response.body.firstName).toBe(newUser.firstName);
      expect(response.body.password).toBeUndefined();
      expect(response.body.emails[0]).toMatchObject({
        email: newUser.username,
        type: 'work',
        isPrimary: true
      });
    });
  });

  it('invalid uername must return 400', async () => {
    expect.hasAssertions();
    const newUser = registerPayload(user1, `missing-username-${Date.now()}@example.com`);
    delete (newUser as any).username;
    const response = await request(server)
      .post('/api/1.0.0/auth/register')
      .send(newUser)
      .set('Content-Type', 'application/json; charset=utf-8')
      .set('Accept', 'application/json; charset=utf-8');
    expect(response.statusCode).toBe(400);
    expect(response.body).toHaveProperty('error');
    expect(response.body.message).toBe('Bad Request - The property username is required.');
  });

  it('invalid password must return 400', async () => {
    expect.hasAssertions();
    const newUser = registerPayload(user1, `invalid-password-${Date.now()}@example.com`);
    newUser.password = '123456';
    const response = await request(server)
      .post('/api/1.0.0/auth/register')
      .send(newUser)
      .set('Content-Type', 'application/json; charset=utf-8')
      .set('Accept', 'application/json; charset=utf-8');
    expect(response.statusCode).toBe(400);
    expect(response.body).toHaveProperty('error');
    expect(response.body.message).toBe('Bad Request - password must have at least 8 chars.');
  });

  it('undefined password must return 400', async () => {
    expect.hasAssertions();
    const newUser = registerPayload(user1, `missing-password-${Date.now()}@example.com`);
    delete (newUser as any).password;
    const response = await request(server)
      .post('/api/1.0.0/auth/register')
      .send(newUser)
      .set('Content-Type', 'application/json; charset=utf-8')
      .set('Accept', 'application/json; charset=utf-8');
    expect(response.statusCode).toBe(400);
    expect(response.body).toHaveProperty('error');
    expect(response.body.message).toBe('Bad Request - The property password is required.');
  });

  it('non-existing fields must return 400', async () => {
    expect.hasAssertions();
    const username = `unknown-field-${Date.now()}@example.com`;
    const newUser = {
      ...registerPayload(user1, username),
      usernames: username
    };
    const response = await request(server)
      .post('/api/1.0.0/auth/register')
      .send(newUser)
      .set('Content-Type', 'application/json; charset=utf-8')
      .set('Accept', 'application/json; charset=utf-8');
    expect(response.statusCode).toBe(400);
    expect(response.body).toHaveProperty('error');
    expect(response.body.message).toBe('Bad Request - The property usernames from input payload does not exist.');
  });
});
