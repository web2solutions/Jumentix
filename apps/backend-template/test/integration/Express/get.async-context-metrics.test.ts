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

let API: RestAPI<Express>;
let server: any;

describe('express -> /async-context-metrics suite', () => {
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

  it('serves ALS metrics snapshot on GET /async-context-metrics', async () => {
    expect.hasAssertions();
    const response = await request(server).get('/async-context-metrics');
    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual(expect.objectContaining({
      enteredTotal: expect.any(Number),
      exitedTotal: expect.any(Number),
      active: expect.any(Number),
      lastCorrelationIds: expect.any(Array),
      recentStores: expect.any(Array)
    }));
  });
});
