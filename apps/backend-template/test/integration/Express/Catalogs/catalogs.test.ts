/* global describe, it, expect, beforeAll, afterAll */
// file deepcode ignore NoHardcodedPasswords: <mocked passwords>
// file deepcode ignore NoHardcodedCredentials/test: <fake credential>
import request from 'supertest';
import { Express } from 'express';
import { ExpressServer } from '@src/interface/HTTP/adapters/express/ExpressServer';
import { infraHandlers } from '@src/interface/HTTP/adapters/express/handlers/infraHandlers';
import { RestAPI } from '@src/interface/HTTP/RestAPI';
import { InMemoryDbClient } from '@src/infra/persistence/InMemoryDatabase/InMemoryDbClient';
import { AuthService } from '@src/modules/Users/service/AuthService';
import { EHTTPFrameworks } from '@src/interface/HTTP/ports';
import { PasswordCryptoService } from '@src/infra/security/PasswordCryptoService';
import { InMemoryKeyValueStorageClient } from '@src/infra/persistence/KeyValueStorage/InMemoryKeyValueStorageClient';
import { MutexService } from '@src/infra/mutex/adapter/MutexService';
import {
  BasicAuthorizationHeaderUserGuest
} from '@test/mock';
import { EEmailType, EmailValueObject } from '@src/modules/ddd/valueObjects';

import createdUsers from '@seed/users';
import organizations from '@seed/organizations';

import { UserDataRepository, UserService } from '@src/modules/Users';
import { UserProviderLocal } from '@src/modules/Users/service/UserProviderLocal';
import { JwtService } from '@src/infra/jwt/JwtService';
import type { IAuthorizationHeader } from '@src/modules/Users/service/ports/IAuthorizationHeader';
import { EAuthSchemaType } from '@src/modules/Users/service/ports/EAuthSchemaType';
// eslint-disable-next-line import/no-unresolved
import { InMemoryMessageMediatorAdapter } from '@jumentix/message-mediator';
import { CatalogIntegrationEventName } from '@src/modules/Catalogs/events/contracts/CatalogIntegrationEventName';

/**
 * API integration suite for the shared catalog module (JUM-491), over the
 * REAL Express adapter, the REAL RestAPI/OAS wiring, the REAL AuthService
 * (JWT + tenant scope matrix) and the REAL in-memory mediator adapter — no
 * fakes (Requirement 115). It proves the acceptance-critical behaviors
 * end-to-end: server-side authorization aligned to TENANT-RBAC (a client
 * cannot grant itself access), the per-record optimistic concurrency token
 * with a reviewable 409, tombstone deletion semantics with restore, and the
 * `catalogs.catalog.*` event flow on the mediator.
 */

const [createdUser1] = createdUsers;
const [orgZero, orgOne] = organizations;

const webServer = ExpressServer.compile();
const databaseClient = InMemoryDbClient;
const passwordCryptoService = PasswordCryptoService.compile();
const jwtService = JwtService.compile();
const keyValueStorageClient = InMemoryKeyValueStorageClient.compile();
const mutexService = MutexService.compile(keyValueStorageClient);
const messageMediator = new InMemoryMessageMediatorAdapter();

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
let authorizationHeaderSuperadmin: IAuthorizationHeader;
let authorizationHeaderAdminOrg0: IAuthorizationHeader;
let authorizationHeaderUserOrg0: IAuthorizationHeader;
let authorizationHeaderAdminOrg1: IAuthorizationHeader;

const buildTenantUser = (username: string, roles: string[], organization: string) => ({
  firstName: 'Catalog',
  lastName: username,
  emails: [{
    email: `${username}@xpertminds.dev`,
    type: EEmailType.work,
    isPrimary: true
  } as EmailValueObject],
  username: `${username}@xpertminds.dev`,
  password: `catalog-${username}-A1!`,
  organization,
  roles
});

const observedEvents: Record<string, any[]> = {
  created: [], updated: [], deleted: [], restored: []
};

describe('express -> Catalogs -> shared catalog sync target', () => {
  // eslint-disable-next-line jest/require-hook
  const designV1 = { entities: [{ name: 'Invoice', fields: [{ name: 'total', type: 'number' }] }] };
  // eslint-disable-next-line jest/require-hook
  let catalogId = '';

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
      mutexService,
      messageMediator
    });

    server = API.server.application.listen(0);

    await API.seedData();

    authorizationHeaderSuperadmin = {
      ...(await authService.authenticate(
        createdUser1.username,
        createdUser1.password,
        EAuthSchemaType.Basic
      )).result!
    };

    const tenantUsers: Array<[string, string[], string]> = [
      ['catalog-admin', ['admin'], orgZero.id],
      ['catalog-member', ['user'], orgZero.id],
      ['catalog-outsider', ['admin'], orgOne.id]
    ];
    const headers: IAuthorizationHeader[] = [];
    for (const [username, roles, organization] of tenantUsers) {
      const payload = buildTenantUser(username, roles, organization);
      // eslint-disable-next-line no-await-in-loop
      const response = await request(server)
        .post('/api/1.0.0/users')
        .send(payload)
        .set('Content-Type', 'application/json; charset=utf-8')
        .set('Accept', 'application/json; charset=utf-8')
        .set(authorizationHeaderSuperadmin);
      if (response.statusCode !== 201) {
        throw new Error(`tenant user seed failed for ${username}: ${response.statusCode}`);
      }
      // eslint-disable-next-line no-await-in-loop
      const authResult = await authService.authenticate(
        payload.username,
        payload.password,
        EAuthSchemaType.Basic
      );
      headers.push({ ...authResult.result! });
    }
    [
      authorizationHeaderAdminOrg0,
      authorizationHeaderUserOrg0,
      authorizationHeaderAdminOrg1
    ] = headers;

    const observe = (name: string, bucket: any[]) => (event: any) => { bucket.push(event); };
    messageMediator.subscribe(
      CatalogIntegrationEventName.Created,
      observe(CatalogIntegrationEventName.Created, observedEvents.created)
    );
    messageMediator.subscribe(
      CatalogIntegrationEventName.Updated,
      observe(CatalogIntegrationEventName.Updated, observedEvents.updated)
    );
    messageMediator.subscribe(
      CatalogIntegrationEventName.Deleted,
      observe(CatalogIntegrationEventName.Deleted, observedEvents.deleted)
    );
    messageMediator.subscribe(
      CatalogIntegrationEventName.Restored,
      observe(CatalogIntegrationEventName.Restored, observedEvents.restored)
    );
  });

  afterAll(async () => {
    server?.close();
    await databaseClient.disconnect();
    await keyValueStorageClient.disconnect();
  });

  it('a tenant admin publishes a domain design — organization is bound server-side', async () => {
    expect.hasAssertions();
    const response = await request(server)
      .post('/api/1.0.0/catalogs')
      .send({ name: 'Billing', design: designV1, provenance: { package: 'billing', version: '1.0.0' } })
      .set('Content-Type', 'application/json; charset=utf-8')
      .set('Accept', 'application/json; charset=utf-8')
      .set(authorizationHeaderAdminOrg0);
    expect(response.statusCode).toBe(201);
    expect(response.body.version).toBe(1);
    expect(response.body.organization).toBe(orgZero.id);
    expect(response.body.createdBy).toBe('catalog-admin@xpertminds.dev');
    catalogId = response.body.id;
  });

  it('a tenant admin cannot publish into another organization', async () => {
    expect.hasAssertions();
    const response = await request(server)
      .post('/api/1.0.0/catalogs')
      .send({ name: 'Smuggle', design: designV1, organization: orgOne.id })
      .set('Content-Type', 'application/json; charset=utf-8')
      .set('Accept', 'application/json; charset=utf-8')
      .set(authorizationHeaderAdminOrg0);
    expect(response.statusCode).toBe(403);
    expect(response.body.message).toBe('Forbidden - Insufficient permission - cross organization access is forbidden');
  });

  it('a teammate with the user role reads the shared record', async () => {
    expect.hasAssertions();
    const list = await request(server)
      .get('/api/1.0.0/catalogs')
      .set('Accept', 'application/json; charset=utf-8')
      .set(authorizationHeaderUserOrg0);
    expect(list.statusCode).toBe(200);
    expect(list.body.result).toHaveLength(1);
    expect(list.body.result[0].id).toBe(catalogId);

    const one = await request(server)
      .get(`/api/1.0.0/catalogs/${catalogId}`)
      .set('Accept', 'application/json; charset=utf-8')
      .set(authorizationHeaderUserOrg0);
    expect(one.statusCode).toBe(200);
    expect(one.body.name).toBe('Billing');
  });

  it('a teammate updates with the current version and the token bumps', async () => {
    expect.hasAssertions();
    const response = await request(server)
      .put(`/api/1.0.0/catalogs/${catalogId}`)
      .send({
        version: 1,
        design: { entities: [{ name: 'Invoice', fields: [{ name: 'total', type: 'number' }, { name: 'dueAt', type: 'date' }] }] }
      })
      .set('Content-Type', 'application/json; charset=utf-8')
      .set('Accept', 'application/json; charset=utf-8')
      .set(authorizationHeaderUserOrg0);
    expect(response.statusCode).toBe(200);
    expect(response.body.version).toBe(2);
    expect(response.body.updatedBy).toBe('catalog-member@xpertminds.dev');
  });

  it('a stale write is rejected with 409 and the current version for reconciliation', async () => {
    expect.hasAssertions();
    const response = await request(server)
      .put(`/api/1.0.0/catalogs/${catalogId}`)
      .send({ version: 1, description: 'stale edit' })
      .set('Content-Type', 'application/json; charset=utf-8')
      .set('Accept', 'application/json; charset=utf-8')
      .set(authorizationHeaderUserOrg0);
    expect(response.statusCode).toBe(409);
    expect(response.body.message).toContain('Conflict - Stale catalog version');
    expect(response.body.error.metadata.currentVersion).toBe(2);
    expect(response.body.error.metadata.current.id).toBe(catalogId);
  });

  it('the rejected stale write left the server record untouched', async () => {
    expect.hasAssertions();
    const one = await request(server)
      .get(`/api/1.0.0/catalogs/${catalogId}`)
      .set('Accept', 'application/json; charset=utf-8')
      .set(authorizationHeaderUserOrg0);
    expect(one.statusCode).toBe(200);
    expect(one.body.version).toBe(2);
    expect(one.body.description).toBe('');
  });

  it('the user role cannot delete — the scope matrix denies delete_catalog', async () => {
    expect.hasAssertions();
    const response = await request(server)
      .delete(`/api/1.0.0/catalogs/${catalogId}?version=2`)
      .set('Accept', 'application/json; charset=utf-8')
      .set(authorizationHeaderUserOrg0);
    expect(response.statusCode).toBe(403);
    expect(response.body.message).toBe('Forbidden - Insufficient permission - user must have the delete_catalog role');
  });

  it('an admin soft-deletes: the record leaves the default feed but survives as a tombstone', async () => {
    expect.hasAssertions();
    const response = await request(server)
      .delete(`/api/1.0.0/catalogs/${catalogId}?version=2`)
      .set('Accept', 'application/json; charset=utf-8')
      .set(authorizationHeaderAdminOrg0);
    expect(response.statusCode).toBe(200);

    const activeOnly = await request(server)
      .get('/api/1.0.0/catalogs')
      .set('Accept', 'application/json; charset=utf-8')
      .set(authorizationHeaderAdminOrg0);
    expect(activeOnly.body.result).toHaveLength(0);

    const withDeleted = await request(server)
      .get('/api/1.0.0/catalogs?includeDeleted=true')
      .set('Accept', 'application/json; charset=utf-8')
      .set(authorizationHeaderAdminOrg0);
    expect(withDeleted.body.result).toHaveLength(1);
    expect(withDeleted.body.result[0].deletedAt).not.toBe('');
    expect(withDeleted.body.result[0].version).toBe(3);
  });

  it('a delete with a stale version is rejected with 409', async () => {
    expect.hasAssertions();
    const response = await request(server)
      .delete(`/api/1.0.0/catalogs/${catalogId}?version=1`)
      .set('Accept', 'application/json; charset=utf-8')
      .set(authorizationHeaderAdminOrg0);
    expect(response.statusCode).toBe(409);
  });

  it('an admin restores the tombstoned record — deletion is recoverable', async () => {
    expect.hasAssertions();
    const response = await request(server)
      .post(`/api/1.0.0/catalogs/${catalogId}/restore`)
      .send({ version: 3 })
      .set('Content-Type', 'application/json; charset=utf-8')
      .set('Accept', 'application/json; charset=utf-8')
      .set(authorizationHeaderAdminOrg0);
    expect(response.statusCode).toBe(200);
    expect(response.body.deletedAt).toBe('');
    expect(response.body.version).toBe(4);
  });

  it('another organization cannot see the record — cross-tenant reads are denied', async () => {
    expect.hasAssertions();
    const one = await request(server)
      .get(`/api/1.0.0/catalogs/${catalogId}`)
      .set('Accept', 'application/json; charset=utf-8')
      .set(authorizationHeaderAdminOrg1);
    expect(one.statusCode).toBe(403);

    const list = await request(server)
      .get('/api/1.0.0/catalogs')
      .set('Accept', 'application/json; charset=utf-8')
      .set(authorizationHeaderAdminOrg1);
    expect(list.statusCode).toBe(200);
    expect(list.body.result).toHaveLength(0);
  });

  it('a legacy-scope principal without catalog scopes is denied', async () => {
    expect.hasAssertions();
    const legacyHeader = {
      ...(await authService.authenticate(
        createdUsers[1].username,
        createdUsers[1].password,
        EAuthSchemaType.Basic
      )).result!
    };
    const response = await request(server)
      .get('/api/1.0.0/catalogs')
      .set('Accept', 'application/json; charset=utf-8')
      .set(legacyHeader);
    expect(response.statusCode).toBe(403);
  });

  it('a guest is unauthorized', async () => {
    expect.hasAssertions();
    const response = await request(server)
      .get('/api/1.0.0/catalogs')
      .set('Accept', 'application/json; charset=utf-8')
      .set(BasicAuthorizationHeaderUserGuest);
    expect(response.statusCode).toBe(401);
  });

  it('every write published its integration event on the mediator with the new version', async () => {
    expect.hasAssertions();
    expect(observedEvents.created.map((event) => event.payload)).toContainEqual(
      expect.objectContaining({ id: catalogId, organization: orgZero.id, version: 1 })
    );
    expect(observedEvents.updated.map((event) => event.payload)).toContainEqual(
      expect.objectContaining({ id: catalogId, version: 2 })
    );
    expect(observedEvents.deleted.map((event) => event.payload)).toContainEqual(
      expect.objectContaining({ id: catalogId, version: 3 })
    );
    expect(observedEvents.restored.map((event) => event.payload)).toContainEqual(
      expect.objectContaining({ id: catalogId, version: 4 })
    );
  });
});
