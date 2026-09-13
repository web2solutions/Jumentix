/* global  describe, it, expect */
import request from 'supertest';
import { Express } from 'express';
import { ExpressServer } from '@src/interface/HTTP/adapters/express/ExpressServer';
import { infraHandlers } from '@src/interface/HTTP/adapters/express/handlers/infraHandlers';
import { RestAPI } from '@src/interface/HTTP/RestAPI';
import { InMemoryDbClient } from '@src/infra/persistence/InMemoryDatabase/InMemoryDbClient';
import { AuthService } from '@src/modules/Users/service/AuthService';
import { EHTTPFrameworks } from '@src/interface/HTTP/ports';
import { InMemoryKeyValueStorageClient } from '@src/infra/persistence/KeyValueStorage/InMemoryKeyValueStorageClient';
import { MutexService } from '@src/infra/mutex/adapter/MutexService';
import users from '@seed/users';
import {
  BasicAuthorizationHeaderUser1,
  BasicAuthorizationHeaderUser2,
  BasicAuthorizationHeaderUser3,
  BasicAuthorizationHeaderUser4,
  BasicAuthorizationHeaderUserGuest
} from '@test/mock';
import { PasswordCryptoService } from '@src/infra/security/PasswordCryptoService';
import { UserDataRepository, UserService } from '@src/modules/Users';
import { JwtService } from '@src/infra/jwt/JwtService';
import { UserProviderLocal } from '@src/modules/Users/service/UserProviderLocal';
import { closeServer } from '../closeServer';

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

let API: any;
let server: any;

describe('express -> get Users suite', () => {
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
  });

  beforeEach(async () => {
    // await server.ready();
    await API.deleteUsers();
    await API.seedUsers();
  });

  afterAll(async () => {
    await API.deleteUsers();
    await databaseClient.disconnect();
    await keyValueStorageClient.disconnect();
    await closeServer(server);
  });

  it('user1 must be able to read all users', async () => {
    expect.hasAssertions();
    const response = await request(server)
      .get('/api/1.0.0/users')
      .set('Content-Type', 'application/json; charset=utf-8')
      .set('Accept', 'application/json; charset=utf-8')
      .set(BasicAuthorizationHeaderUser1);
    expect(response.statusCode).toBe(200);
    expect(response.body.result).toHaveLength(users.length);
    expect(response.body.total).toBe(users.length);
  });

  it('user2 must be able to read all users', async () => {
    expect.hasAssertions();
    const response = await request(server)
      .get('/api/1.0.0/users')
      .set('Content-Type', 'application/json; charset=utf-8')
      .set('Accept', 'application/json; charset=utf-8')
      .set(BasicAuthorizationHeaderUser2);
    expect(response.statusCode).toBe(200);
    expect(response.body.result).toHaveLength(users.length);
    expect(response.body.total).toBe(users.length);
  });

  it('user3 must be able to read all users', async () => {
    expect.hasAssertions();
    const response = await request(server)
      .get('/api/1.0.0/users')
      .set('Content-Type', 'application/json; charset=utf-8')
      .set('Accept', 'application/json; charset=utf-8')
      .set(BasicAuthorizationHeaderUser3);
    expect(response.statusCode).toBe(200);
    expect(response.body.result).toHaveLength(users.length);
    expect(response.body.total).toBe(users.length);
  });

  /**
   * JUM-777 — the paginated list contract declared by `x-list-capabilities`.
   * Each request below is one the frontend X-CRUD kit issues; the assertions
   * are on the wire shape and on the 400 messages naming the accepted values.
   */
  const b64 = (value: unknown): string => Buffer.from(JSON.stringify(value)).toString('base64');
  const list = (query: string) => request(server)
    .get(`/api/1.0.0/users${query}`)
    .set('Accept', 'application/json; charset=utf-8')
    .set(BasicAuthorizationHeaderUser1);

  it('pages with page/size and reports the total across pages', async () => {
    expect.hasAssertions();
    const first = await list('?page=1&size=2');
    expect(first.statusCode).toBe(200);
    expect(first.body).toMatchObject({ page: 1, size: 2, total: users.length });
    expect(first.body.result).toHaveLength(2);
    const last = await list(`?page=${Math.ceil(users.length / 2)}&size=2`);
    expect(last.statusCode).toBe(200);
    expect(last.body.result.length).toBeGreaterThan(0);
  });

  it('answers 400 for a page past the last one instead of an empty page', async () => {
    expect.hasAssertions();
    const beyond = await list(`?page=${Math.ceil(users.length / 2) + 1}&size=2`);
    expect(beyond.statusCode).toBe(400);
  });

  it('sorts by a sortable field in both directions', async () => {
    expect.hasAssertions();
    const asc = await list('?sort=firstName:asc&size=100');
    const desc = await list('?sort=firstName:desc&size=100');
    expect(asc.statusCode).toBe(200);
    expect(desc.statusCode).toBe(200);
    const ascNames = asc.body.result.map((u: any) => String(u.firstName).toLowerCase());
    expect(ascNames).toStrictEqual([...ascNames].sort((a, b) => a.localeCompare(b)));
    const lastAsc = asc.body.result[asc.body.result.length - 1].firstName;
    expect(desc.body.result[0].firstName).toBe(lastAsc);
  });

  it('filters by equality on an array field (roles=admin)', async () => {
    expect.hasAssertions();
    const admins = await list(`?filter=${b64({ roles: 'admin' })}&size=100`);
    expect(admins.statusCode).toBe(200);
    expect(admins.body.total).toBeGreaterThan(0);
    expect(admins.body.result.every((u: any) => u.roles.includes('admin'))).toBe(true);
  });

  it('filters with contains on text and searches with q', async () => {
    expect.hasAssertions();
    const target = users[0];
    const needle = target.firstName.slice(0, 3).toUpperCase();
    const contains = await list(`?filter=${b64({ firstName: { operator: 'contains', value: needle } })}`);
    expect(contains.statusCode).toBe(200);
    expect(contains.body.result.some((u: any) => u.username === target.username)).toBe(true);

    const searched = await list(`?q=${encodeURIComponent(target.lastName.slice(0, 4))}`);
    expect(searched.statusCode).toBe(200);
    expect(searched.body.result.some((u: any) => u.username === target.username)).toBe(true);
  });

  it('rejects unknown sort/filter fields with the accepted list', async () => {
    expect.hasAssertions();
    const badSort = await list('?sort=password:asc');
    expect(badSort.statusCode).toBe(400);
    expect(badSort.body.message).toContain(
      'The sort field "password" is not sortable. Accepted: firstName, lastName, username, organization, createdAt, updatedAt.'
    );
    const badFilter = await list(`?filter=${b64({ password: 'x' })}`);
    expect(badFilter.statusCode).toBe(400);
    expect(badFilter.body.message).toContain('The filter field "password" is not filterable.');
  });

  it('rejects oversize pages and non-numeric page numbers', async () => {
    expect.hasAssertions();
    const tooBig = await list('?size=101');
    expect(tooBig.statusCode).toBe(400);
    const notANumber = await list('?page=two');
    expect(notANumber.statusCode).toBe(400);
  });

  it('user4 must not be able to read all users - Forbidden: read_user role required', async () => {
    expect.hasAssertions();
    const response = await request(server)
      .get('/api/1.0.0/users')
      .set('Content-Type', 'application/json; charset=utf-8')
      .set('Accept', 'application/json; charset=utf-8')
      .set(BasicAuthorizationHeaderUser4);
    // console.log(response.body.message)
    expect(response.statusCode).toBe(403);
    expect(response.body.message).toBe('Forbidden - Insufficient permission - user must have the read_user role');
  });

  it('guest must not be able to read an user data - Unauthorized', async () => {
    expect.hasAssertions();
    const response = await request(server)
      .get('/api/1.0.0/users')
      .set('Content-Type', 'application/json; charset=utf-8')
      .set('Accept', 'application/json; charset=utf-8')
      .set(BasicAuthorizationHeaderUserGuest);
    // console.log(response.body)
    expect(response.statusCode).toBe(401);
    expect(response.body.message).toBe('Unauthorized - user not found');
  });
});
