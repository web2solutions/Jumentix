/* global describe, it, expect, beforeAll, beforeEach, afterAll, jest */
// file deepcode ignore NoHardcodedPasswords: <mocked passwords>
// file deepcode ignore NoHardcodedCredentials/test: <fake credential>
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable jest/max-expects, jest/prefer-expect-assertions */
import path from 'node:path';
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
 * Multi-user convergence integration suite (JUM-491) — the issue's headline
 * acceptance criterion: TWO designer clients converge after a partition,
 * proven with a REAL disconnection, not mocked latency.
 *
 * Everything structural here is real (Requirement 115): the backend is the
 * REAL RestAPI over the REAL Express adapter listening on an ephemeral
 * loopback port, with the REAL AuthService (JWT + TENANT-RBAC scope matrix),
 * the REAL in-memory mediator adapter (integration events observed directly),
 * and the designer side runs the REAL `catalogSyncClient` + `designerState` +
 * `CanaDesignerStore` with the REAL `createCatalogHttpTransport` over Node's
 * REAL `fetch`. The partition is a REAL connection refusal: Bob's transport
 * is repointed at a closed loopback port, so every call fails with
 * ECONNREFUSED — the same failure the network would produce. The only double
 * is the per-host Cana client (the declared in-memory double of the
 * Jumentix-owned Cana contract, as in the designerSync suite), because two
 * browser tabs' IndexedDB cannot exist in a Node process.
 */

jest.setTimeout(60000);

const repoRoot = path.resolve(__dirname, '../../../../..');
const {
  createDesignerState,
  createDefaultView
} = require(path.join(repoRoot, 'apps', 'service-management', 'src', 'state', 'designerState.js'));
const {
  createCatalogSyncClient,
  createCatalogHttpTransport
} = require(path.join(repoRoot, 'apps', 'service-management', 'src', 'state', 'catalogSyncClient.js'));
const {
  CanaDesignerStore
} = require(path.join(repoRoot, 'apps', 'service-management', 'src', 'store', 'CanaDesignerStore.js'));

const STORE_NAME = 'designerDocuments';

const [createdUser1] = createdUsers;
const [orgZero] = organizations;

const webServer = ExpressServer.compile();
const databaseClient = InMemoryDbClient;
const passwordCryptoService = PasswordCryptoService.compile();
const jwtService = JwtService.compile();
const keyValueStorageClient = InMemoryKeyValueStorageClient.compile();
const mutexService = MutexService.compile(keyValueStorageClient);
const messageMediator = new InMemoryMessageMediatorAdapter();

const dataRepository = UserDataRepository.compile({ databaseClient: InMemoryDbClient });
const userService = UserService.compile({
  dataRepository,
  services: { passwordCryptoService, mutexService }
});
const userProvider = UserProviderLocal.compile(userService);
const authService = AuthService.compile(userProvider, passwordCryptoService, jwtService);

/* eslint-disable jest/require-hook */
let API: RestAPI<Express>;
let listener: any;
let baseUrl = '';
let aliceHeader: IAuthorizationHeader;
let bobHeader: IAuthorizationHeader;
/* eslint-enable jest/require-hook */

// eslint-disable-next-line jest/require-hook
const observedEvents: Record<string, any[]> = {
  created: [], updated: [], deleted: [], restored: []
};

/** The declared in-memory Cana double (as in the designerSync suite). */
function createCanaClientDouble(backend: { records: Map<string, string> }, clientId: string) {
  const listeners = new Set<(event: any) => void>();
  let cursor = 0;
  let txSeq = 0;
  return {
    async open() { return undefined; },
    table(name: string) {
      return {
        name,
        async get(key: string) {
          return backend.records.has(key) ? backend.records.get(key) : undefined;
        }
      };
    },
    async transaction(
      _mode: string,
      _stores: readonly string[],
      body: (scope: any) => Promise<unknown>
    ) {
      const staged: Array<{ op: 'put' | 'delete'; key: string; value?: string }> = [];
      const scope = {
        table: () => ({
          async put(value: string, key: string) { staged.push({ op: 'put', key, value }); },
          async delete(key: string) { staged.push({ op: 'delete', key }); }
        }),
        abort: () => undefined
      };
      const result = await body(scope);
      txSeq += 1;
      staged.forEach(({ op, key, value }) => {
        if (op === 'put') backend.records.set(key, value as string);
        else backend.records.delete(key);
        cursor += 1;
        const event = {
          type: op === 'put' ? 'updated' : 'deleted',
          store: STORE_NAME,
          key,
          record: op === 'put' ? value : undefined,
          cursor,
          correlationId: `${clientId}:${txSeq}`,
          at: 1722000000000 + txSeq,
          originId: clientId
        };
        listeners.forEach((canaListener) => canaListener(event));
      });
      return {
        outcome: 'committed', result, events: [], correlationId: `${clientId}:${txSeq}`, attemptedAt: 1722000000000 + txSeq
      };
    },
    subscribe(canaListener: (event: any) => void) {
      listeners.add(canaListener);
      return () => { listeners.delete(canaListener); };
    },
    async storageState() {
      return { persistent: true, nearQuota: false, evicted: false };
    }
  };
}

function makeEntity(id: string, name: string) {
  return {
    id,
    name,
    x: 14,
    y: 14,
    fields: [],
    meta: {
      aggregateRoot: false, invariants: [], rbac: {}, contracts: [], oasComposition: {}
    }
  };
}

function makeDomain(id: string, name: string, entities: any[] = []) {
  return {
    id, name, color: '#60a5fa', x: 10, y: 10, context: {}, entities
  };
}

let hostSeq = 0; // eslint-disable-line jest/require-hook

/** A designer host wired to the REAL backend over REAL HTTP. */
async function createHost(seedDomains: any[], header: IAuthorizationHeader) {
  hostSeq += 1;
  const backend = { records: new Map<string, string>() };
  const client = createCanaClientDouble(backend, `host-${hostSeq}`);
  const store = new CanaDesignerStore({ client });
  const notifications: Array<{ message: string; severity: string }> = [];
  const timers: Map<number, { fn: () => unknown }> = new Map();
  let timerSeq = 0;
  let core: any;
  const seed = () => {
    core.state.domains = JSON.parse(JSON.stringify(seedDomains));
    core.state.selectedDomainId = seedDomains[0]?.id ?? null;
    core.state.idCounter = 100;
    core.state.view = createDefaultView();
  };
  core = createDesignerState({ store, seed, render: () => undefined });
  await core.loadState();
  // The partition handle: a mutable baseUrl. Repointing at the closed port
  // produces REAL ECONNREFUSED failures on every call.
  const endpoint = { url: baseUrl };
  const transport = createCatalogHttpTransport({
    baseUrl: () => endpoint.url,
    tokenProvider: () => header.Authorization
  });
  const schedule = (fn: () => unknown) => {
    timerSeq += 1;
    timers.set(timerSeq, { fn });
    return timerSeq;
  };
  const syncClient = createCatalogSyncClient({
    designerState: core,
    store,
    transport,
    notify: (message: string, severity: string) => notifications.push({ message, severity }),
    schedule,
    cancelSchedule: (handle: number) => timers.delete(handle),
    pollIntervalMs: 3600000,
    pushDebounceMs: 5
  });
  const flushTimers = async () => {
    const pending = [...timers.values()];
    timers.clear();
    for (const timer of pending) {
      // eslint-disable-next-line no-await-in-loop
      await timer.fn();
    }
  };
  return {
    backend, core, syncClient, notifications, endpoint, flushTimers
  };
}

const domainNames = (host: any) => host.core.state.domains.map((domain: any) => domain.name);

describe('jum-491 — two designer clients converge over the real backend', () => {
  beforeAll(async () => {
    await databaseClient.connect();
    await keyValueStorageClient.connect();

    API = new RestAPI<Express>({
      databaseClient,
      webServer,
      infraHandlers,
      serverType: EHTTPFrameworks.express,
      authService,
      passwordCryptoService,
      keyValueStorageClient,
      mutexService,
      messageMediator
    });
    await API.seedData();

    const superadminHeader = {
      ...(await authService.authenticate(
        createdUser1.username,
        createdUser1.password,
        EAuthSchemaType.Basic
      )).result!
    };
    const app = API.server.application;
    const buildUser = (username: string, roles: string[]) => ({
      firstName: 'Sync',
      lastName: username,
      emails: [{
        email: `${username}@xpertminds.dev`,
        type: EEmailType.work,
        isPrimary: true
      } as EmailValueObject],
      username: `${username}@xpertminds.dev`,
      password: `sync-${username}-A1!`,
      organization: orgZero.id,
      roles
    });
    for (const [username, roles] of [['sync-alice', ['admin']], ['sync-bob', ['user']]] as Array<[string, string[]]>) {
      const payload = buildUser(username, roles);
      // eslint-disable-next-line no-await-in-loop
      const created = await request(app)
        .post('/api/1.0.0/users')
        .send(payload)
        .set('Content-Type', 'application/json; charset=utf-8')
        .set('Accept', 'application/json; charset=utf-8')
        .set(superadminHeader);
      if (created.statusCode !== 201) {
        throw new Error(`tenant user seed failed: ${created.statusCode}`);
      }
    }
    aliceHeader = {
      ...(await authService.authenticate('sync-alice@xpertminds.dev', 'sync-sync-alice-A1!', EAuthSchemaType.Basic)).result!
    };
    bobHeader = {
      ...(await authService.authenticate('sync-bob@xpertminds.dev', 'sync-sync-bob-A1!', EAuthSchemaType.Basic)).result!
    };

    messageMediator.subscribe(
      CatalogIntegrationEventName.Created,
      (event) => { observedEvents.created.push(event); }
    );
    messageMediator.subscribe(
      CatalogIntegrationEventName.Updated,
      (event) => { observedEvents.updated.push(event); }
    );
    messageMediator.subscribe(
      CatalogIntegrationEventName.Deleted,
      (event) => { observedEvents.deleted.push(event); }
    );
    messageMediator.subscribe(
      CatalogIntegrationEventName.Restored,
      (event) => { observedEvents.restored.push(event); }
    );

    listener = app.listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => { listener.once('listening', resolve); });
    baseUrl = `http://127.0.0.1:${listener.address().port}`;
  });

  beforeEach(() => {
    // Test hygiene: every case publishes its own records, so the in-memory
    // Catalog store is reset between cases — records from an earlier case
    // must never leak into another host's read-back.
    (InMemoryDbClient.stores.Catalog as any).records.clear();
  });

  afterAll(async () => {
    if (listener) {
      await new Promise<void>((resolve) => { listener.close(() => resolve()); });
    }
    await databaseClient.disconnect();
    await keyValueStorageClient.disconnect();
  });

  it('alice publishes; Bob converges from the shared catalog on his first read-back', async () => {
    expect.hasAssertions();
    const alice = await createHost([makeDomain('domain-a', 'Billing', [makeEntity('entity-a1', 'Invoice')])], aliceHeader);
    const started = await alice.syncClient.start();
    expect(started.converged).toBe(true);

    const { published, record } = await alice.syncClient.publishDomain('domain-a');
    expect(published).toBe(true);
    expect(record.version).toBe(1);
    expect(record.organization).toBe(orgZero.id);

    const bob = await createHost([], bobHeader);
    await bob.syncClient.start();
    expect(domainNames(bob)).toContain('Billing');
    expect(bob.core.state.domains[0].context.catalog.id).toBe(record.id);
    await bob.syncClient.stop();
    await alice.syncClient.stop();
  });

  it('bob edits the shared domain; Alice converges on her next read-back', async () => {
    expect.hasAssertions();
    const alice = await createHost([makeDomain('domain-a', 'Billing', [makeEntity('entity-a1', 'Invoice')])], aliceHeader);
    await alice.syncClient.start();
    const { record } = await alice.syncClient.publishDomain('domain-a');

    const bob = await createHost([], bobHeader);
    await bob.syncClient.start();
    expect(domainNames(bob)).toContain('Billing');

    bob.core.state.domains[0].entities.push(makeEntity('entity-b1', 'Payment'));
    await bob.core.saveState();
    await bob.flushTimers();

    const serverRecord = await request(API.server.application)
      .get(`/api/1.0.0/catalogs/${record.id}`)
      .set('Accept', 'application/json; charset=utf-8')
      .set(aliceHeader);
    expect(serverRecord.body.version).toBe(2);
    expect(serverRecord.body.design.domain.entities.map((entity: any) => entity.name)).toContain('Payment');

    await alice.syncClient.syncNow();
    expect(alice.core.state.domains[0].entities.map((entity: any) => entity.name)).toContain('Payment');
    expect(alice.core.state.domains[0].context.catalog.version).toBe(2);
    await bob.syncClient.stop();
    await alice.syncClient.stop();
  });

  it('partition: Bob disconnected (real ECONNREFUSED), both edit — Bob heals into a reviewable conflict and converges', async () => {
    expect.hasAssertions();
    const alice = await createHost([makeDomain('domain-a', 'Billing', [makeEntity('entity-a1', 'Invoice')])], aliceHeader);
    await alice.syncClient.start();
    const { record } = await alice.syncClient.publishDomain('domain-a');

    const bob = await createHost([], bobHeader);
    await bob.syncClient.start();
    expect(domainNames(bob)).toContain('Billing');

    // REAL partition: Bob's endpoint becomes a closed port; every call fails
    // with ECONNREFUSED — the network's own failure, not a scripted double.
    const deadPort = listener.address().port + 1000;
    bob.endpoint.url = `http://127.0.0.1:${deadPort}`;
    const partitioned = await bob.syncClient.syncNow();
    expect(partitioned.synced).toBe(false);
    expect(bob.syncClient.getStatus().degraded).toBe(true);
    expect(bob.notifications.some((entry) => entry.severity === 'error')).toBe(true);

    // Both sides keep working through the partition.
    bob.core.state.domains[0].entities.push(makeEntity('entity-b2', 'BobPartitionEntity'));
    await bob.core.saveState();
    await bob.flushTimers();
    alice.core.state.domains[0].entities.push(makeEntity('entity-a2', 'AliceEntity'));
    await alice.core.saveState();
    await alice.flushTimers();
    // Alice also shares a second domain during the partition.
    alice.core.state.domains.push(makeDomain('domain-a3', 'Shipping', [makeEntity('entity-a3', 'Shipment')]));
    await alice.core.saveState();
    await alice.syncClient.publishDomain('domain-a3');

    // Heal: Bob's endpoint is the real server again.
    bob.endpoint.url = baseUrl;
    const healed = await bob.syncClient.syncNow();
    expect(healed.synced).toBe(true);
    expect(bob.syncClient.getStatus().degraded).toBe(false);

    // Alice's new domain converged into Bob's document...
    expect(domainNames(bob)).toContain('Shipping');
    // ...and the contested domain is a REVIEWABLE conflict: Bob's partitioned
    // edit survives, the server holds Alice's version.
    const conflicts = bob.syncClient.getConflicts();
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].catalogId).toBe(record.id);
    const bobBilling = bob.core.state.domains.find((domain: any) => domain.name === 'Billing');
    expect(bobBilling.entities.map((entity: any) => entity.name)).toContain('BobPartitionEntity');

    // Bob takes the server version; both sides converge to the same document.
    const { resolved } = await bob.syncClient.resolveConflict(record.id, 'take-server');
    expect(resolved).toBe(true);
    const bobAfter = bob.core.state.domains.find((domain: any) => domain.name === 'Billing');
    expect(bobAfter.entities.map((entity: any) => entity.name)).toContain('AliceEntity');
    // The server record is at version 2 (Alice's push during the partition);
    // Bob's take-server rebased his marker to exactly that.
    expect(bobAfter.context.catalog.version).toBe(2);
    await alice.syncClient.syncNow();
    const aliceBilling = alice.core.state.domains.find((domain: any) => domain.name === 'Billing');
    expect(aliceBilling.context.catalog.version).toBe(2);
    expect(domainNames(alice).sort()).toStrictEqual(domainNames(bob).sort());

    await bob.syncClient.stop();
    await alice.syncClient.stop();
  });

  it('deletion propagates as a tombstone and restore recovers it — and Bob (user role) cannot delete', async () => {
    expect.hasAssertions();
    const alice = await createHost([makeDomain('domain-a', 'Billing', [makeEntity('entity-a1', 'Invoice')])], aliceHeader);
    await alice.syncClient.start();
    const { record } = await alice.syncClient.publishDomain('domain-a');

    const bob = await createHost([], bobHeader);
    await bob.syncClient.start();
    expect(domainNames(bob)).toContain('Billing');

    // Bob's role (user) holds no delete_catalog scope: the server denies.
    const denied = await request(API.server.application)
      .delete(`/api/1.0.0/catalogs/${record.id}?version=1`)
      .set('Accept', 'application/json; charset=utf-8')
      .set(bobHeader);
    expect(denied.statusCode).toBe(403);

    await alice.syncClient.unpublishDomain('domain-a');
    await bob.syncClient.syncNow();
    expect(domainNames(bob)).not.toContain('Billing');

    // The tombstone is recoverable: an admin restore re-shares the record and
    // Bob re-admits it; Alice re-links by taking the record back.
    const restored = await request(API.server.application)
      .post(`/api/1.0.0/catalogs/${record.id}/restore`)
      .send({ version: 2 })
      .set('Content-Type', 'application/json; charset=utf-8')
      .set('Accept', 'application/json; charset=utf-8')
      .set(aliceHeader);
    expect(restored.statusCode).toBe(200);
    await bob.syncClient.syncNow();
    expect(domainNames(bob)).toContain('Billing');

    await bob.syncClient.stop();
    await alice.syncClient.stop();
  });

  it('the mediator carried the whole event flow with the concurrency tokens', async () => {
    expect.hasAssertions();
    expect(observedEvents.created.length).toBeGreaterThanOrEqual(3);
    expect(observedEvents.updated.length).toBeGreaterThanOrEqual(2);
    expect(observedEvents.deleted.length).toBeGreaterThanOrEqual(1);
    expect(observedEvents.restored.length).toBeGreaterThanOrEqual(1);
    for (const event of [...observedEvents.created, ...observedEvents.updated]) {
      expect(event.payload.organization).toBe(orgZero.id);
      expect(typeof event.payload.version).toBe('number');
    }
  });
});
