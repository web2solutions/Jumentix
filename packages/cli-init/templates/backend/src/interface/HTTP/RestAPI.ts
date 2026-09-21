/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/no-explicit-any */

import fs from 'fs';
import YAML from 'yaml';
import { OpenAPIV3 } from 'openapi-types';

import { _API_PREFIX_, _DOCS_PREFIX_ } from '@src/config/constants';
import { replaceVars } from '@src/shared/utils';
import type { IAPIFactory } from '@src/interface/HTTP/ports';
import { EHTTPFrameworks, HTTPBaseServer } from '@src/interface/HTTP/ports';

import type { IDatabaseClient } from '@src/infra/persistence/port/IDatabaseClient';
import type { IMutexService } from '@src/infra/mutex/port/IMutexService';
import type { IPasswordCryptoService } from '@src/infra/security/IPasswordCryptoService';
import type { IKeyValueStorageClient } from '@src/infra/persistence/KeyValueStorage/IKeyValueStorageClient';
import type { IEventBus, IMessageMediator } from '@src/modules/port';

import type {
  IUser,
  IAuthService
} from '@src/modules/Users';
import {
  composeUsersAuthServices
} from '@src/modules/Users';

import users, { seedUserIds } from '@seed/users';
import organizations, { seedOrganizationIds } from '@seed/organizations';
import { assertSeedIdNotPurged } from '@jumentix/persistence-contracts';
import { entityIdLedger } from '@src/infra/persistence/InMemoryDatabase/idReservationLedger';
import { purgeUserAndOrganizationTombstones } from '@src/infra/persistence/purgeStores';

export class RestAPI<T> {
  private readonly oas: Map<string, OpenAPIV3.Document> = new Map();

  private readonly asyncApiSpecs: Map<string, Record<string, any>> = new Map();

  private started: boolean = false;

  public readonly server: HTTPBaseServer<T>;

  private readonly serverType: EHTTPFrameworks;

  public readonly databaseClient: IDatabaseClient;

  public readonly mutexClient: IMutexService | undefined;

  private readonly authService: IAuthService | undefined;

  private readonly passwordCryptoService: IPasswordCryptoService | undefined;

  private readonly keyValueStorageClient: IKeyValueStorageClient | undefined;

  private readonly eventBus: IEventBus | undefined;

  private readonly messageMediator: IMessageMediator | undefined;

  private usersComposition: ReturnType<typeof composeUsersAuthServices> | undefined;

  constructor(config: IAPIFactory<T>) {
    this.serverType = config.serverType ?? EHTTPFrameworks.express;
    this.server = config.webServer;

    this.databaseClient = config.databaseClient;

    if (config.keyValueStorageClient) {
      this.keyValueStorageClient = config.keyValueStorageClient;
    }

    if (config.mutexService) {
      this.mutexClient = config.mutexService;
    }

    if (config.authService) {
      this.authService = config.authService;
      // this.authService?.start();
    }

    if (config.passwordCryptoService) {
      this.passwordCryptoService = config.passwordCryptoService;
    }

    if (config.eventBus) {
      this.eventBus = config.eventBus;
    }

    if (config.messageMediator) {
      this.messageMediator = config.messageMediator;
      this.eventBus = config.messageMediator;
    }

    this.buildWithOAS();
    this.buildInfraEndPoints(config);

    process.on('exit', () => {
      this.stop();
    });

    process.on('unhandledRejection', (e) => {
      // eslint-disable-next-line no-console
      console.error(e);
      process.exit(1);
    });
  }

  private buildInfraEndPoints(config: IAPIFactory<T>): void {
    const noServiceInjection = {
      databaseClient: {} as IDatabaseClient,
      spec: {} as OpenAPIV3.Document,
      endPointConfig: {}
    };

    const localhostGet = config.infraHandlers.localhostGetHandlerFactory({ ...noServiceInjection });
    this.server.endPointRegister(localhostGet);

    // AsyncLocalStorage request-context metrics for Service Management scrape
    // (Monitoring tab / Contract 1c+1d). Loopback-oriented; no request body.
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const { snapshotAsyncContextMetrics } = require('@src/infra/context/Context');
    this.server.endPointRegister({
      method: 'get',
      path: '/async-context-metrics',
      handler: (_req: any, res: any): void => {
        res.status(200).json(snapshotAsyncContextMetrics());
      }
    });

    this.server.endPointRegister({
      method: 'post',
      path: '/internal/tombstones/purge',
      handler: async (req: any, res: any): Promise<void> => {
        const ip = String(req.ip || req.socket?.remoteAddress || '');
        const loopback = ip === '127.0.0.1' || ip === '::1' || ip.endsWith('127.0.0.1');
        if (!loopback) {
          res.status(403).json({ error: 'Purge is loopback-only.' });
          return;
        }
        const body = req.body || {};
        const report = await this.purgeTombstones({
          commit: body.commit === true,
          olderThanDays: Number(body.olderThanDays) || undefined,
          protectSeed: body.protectSeed !== false
        });
        res.status(200).json(report);
      }
    });

    // serve API docs as JSON
    const apiVersionsGet = config.infraHandlers.apiVersionsGetHandlerFactory({
      ...noServiceInjection,
      apiDocs: this.oas,
      authService: this.authService || ({} as IAuthService)

    });
    this.server.endPointRegister(apiVersionsGet);

    for (const [version, spec] of this.oas) {
      this.server.endPointRegister({
        ...config.infraHandlers.apiDocGetHandlerFactory({
          spec,
          version,
          databaseClient: {} as IDatabaseClient,
          endPointConfig: {}
        }),
        path: `${_DOCS_PREFIX_}/${version}`
      });
    }

    this.server.endPointRegister({
      method: 'get',
      path: `${_DOCS_PREFIX_}/asyncapi/versions`,
      handler: (_req: any, res: any): void => {
        const versions: Record<string, string> = {};
        for (const [version] of this.asyncApiSpecs) {
          versions[version] = `${_DOCS_PREFIX_}/asyncapi/${version}`;
        }
        res.status(200).json({ versions });
      }
    });

    for (const [version, spec] of this.asyncApiSpecs) {
      this.server.endPointRegister({
        ...config.infraHandlers.apiDocGetHandlerFactory({
          spec: spec as any,
          version,
          databaseClient: {} as IDatabaseClient,
          endPointConfig: {}
        }),
        path: `${_DOCS_PREFIX_}/asyncapi/${version}`
      });
    }
  }

  private buildWithOAS(): void {
    const specs = fs.readdirSync('./spec')
      .filter((specName) => specName.endsWith('.yml') || specName.endsWith('.yaml'));
    for (const specFileName of specs) {
      const file = fs.readFileSync(`./spec/${specFileName}`, 'utf8');
      const parsedSpec = YAML.parse(file);
      if (parsedSpec?.openapi && parsedSpec?.info?.version) {
        this.oas.set(parsedSpec.info.version, parsedSpec as OpenAPIV3.Document);
      }
    }

    const asyncApiDir = './spec/asyncapi';
    if (fs.existsSync(asyncApiDir) && fs.lstatSync(asyncApiDir).isDirectory()) {
      const asyncApiSpecFiles = fs.readdirSync(asyncApiDir)
        .filter((specName) => specName.endsWith('.yml') || specName.endsWith('.yaml'));
      for (const specFileName of asyncApiSpecFiles) {
        const file = fs.readFileSync(`${asyncApiDir}/${specFileName}`, 'utf8');
        const parsedSpec = YAML.parse(file);
        if (parsedSpec?.asyncapi && parsedSpec?.info?.version) {
          this.asyncApiSpecs.set(parsedSpec.info.version, parsedSpec);
        }
      }
    }
    this.buildEndPoints();
  }

  private buildEndPoints(): void {
    for (const [version, spec] of this.oas) {
      this.registerSpecVersionEndpoints(version, spec);
    }
  }

  private registerSpecVersionEndpoints(version: string, spec: OpenAPIV3.Document): void {
    for (const path of Object.keys(spec.paths)) {
      const endPointConfigs: Record<string, any> = spec.paths[path] ?? {};
      for (const method of Object.keys(endPointConfigs)) {
        this.registerOperationEndpoint(version, spec, path, endPointConfigs[method]);
      }
    }
  }

  private registerOperationEndpoint(
    version: string,
    spec: OpenAPIV3.Document,
    path: string,
    endPointConfig: Record<string, any>
  ): void {
    const module = path.split('/')[1];
    const { moduleName, controllerName } = RestAPI.resolveControllerMetadata(module);
    const ControllerModule = RestAPI.getControllerModule(moduleName, controllerName);
    const usersModuleComposition = moduleName === 'Users' ? this.composeUsersModule() : undefined;

    const controller = new ControllerModule({
      authService: usersModuleComposition?.authService ?? this.authService,
      openApiSpecification: spec,
      databaseClient: this.databaseClient,
      userService: usersModuleComposition?.userService,
      userUseCases: usersModuleComposition?.userUseCases,
      organizationUseCases: usersModuleComposition?.organizationUseCases,
      authUseCases: usersModuleComposition?.authUseCases,
      mutexService: this.mutexClient,
      passwordCryptoService: this.passwordCryptoService,
      messageMediator: this.messageMediator
    });

    const handlerFactory = this.getHandlerFactory({
      moduleName,
      operationId: endPointConfig.operationId,
      databaseClient: this.databaseClient,
      mutexService: this.mutexClient,
      endPointConfig,
      spec,
      authService: this.authService,
      controller
    });

    this.server.endPointRegister({
      ...handlerFactory,
      path: `${_API_PREFIX_}/${version}${replaceVars(handlerFactory.path)}`
    });
  }

  /**
   * "This framework has no handler for that operation", across runtimes.
   *
   * The fallback to Express depends on recognising a missing module, and it
   * used to test `error.code === 'MODULE_NOT_FOUND'` alone. Bun and Node set
   * that code; **Jest's resolver does not** — it throws its own error whose
   * message is `Cannot find module ... from ...` and whose `code` is
   * undefined. So the same adapter fell back correctly under `bun test` and
   * threw under Jest, which is how the Adonis-JS and Total-JS suites passed on
   * one runner and failed on the other (JUM-698).
   */
  private static isModuleNotFound(error: any): boolean {
    if (error?.code === 'MODULE_NOT_FOUND') return true;
    return /cannot find module|could not locate module/i.test(String(error?.message || ''));
  }

  private getHandlerFactory({
    moduleName,
    operationId,
    ...factoryDeps
  }: {
    moduleName: string;
    operationId: string;
    [key: string]: any;
  }): any {
    const frameworkCandidates = [this.serverType, EHTTPFrameworks.express];
    for (const framework of frameworkCandidates) {
      const handlerPath = `@src/modules/${moduleName}/interface/restapi/frameworks/${framework}/handlers/${operationId}`;
      try {
        const handlerModule = require(handlerPath);
        if (typeof handlerModule?.default === 'function') {
          return handlerModule.default(factoryDeps);
        }
      } catch (error: any) {
        if (!RestAPI.isModuleNotFound(error)) {
          throw error;
        }
      }
    }
    throw new Error(
      `Handler not found for module ${moduleName}, operation ${operationId}, framework ${this.serverType}.`
    );
  }

  private static resolveControllerMetadata(
    module: string
  ): { moduleName: string; controllerName: string } {
    if (module === 'auth') {
      return { moduleName: 'Users', controllerName: 'AuthController' };
    }
    if (module === 'organizations') {
      return { moduleName: 'Users', controllerName: 'OrganizationController' };
    }
    const moduleName = `${module.charAt(0).toUpperCase()}${module.substring(1, module.length)}`;
    const controllerName = `${module.charAt(0).toUpperCase()}${module.substring(1, module.length - 1)}Controller`;
    return { moduleName, controllerName };
  }

  private static getControllerModule(moduleName: string, controllerName: string): any {
    const controllerPath = `@src/modules/${moduleName}/adapters/in/http/controllers/${controllerName}`;
    try {
      const controllerModule = require(controllerPath)[controllerName];
      if (controllerModule) {
        return controllerModule;
      }
    } catch (error: any) {
      if (error?.code !== 'MODULE_NOT_FOUND') {
        throw error;
      }
    }

    throw new Error(`Controller ${controllerName} not found for module ${moduleName}.`);
  }

  public async start(): Promise<void> {
    if (this.started) return;
    if (this.keyValueStorageClient) {
      await this.keyValueStorageClient.connect();
    }

    await this.databaseClient.connect();
    await this.server.start();
    this.startDeadLetterReplay();
    this.started = true;
  }

  /**
   * JUM-53 — drain the writes the mutex refused.
   *
   * The composition builds the worker and deliberately leaves it stopped: a
   * background timer is the runtime's to own. This is the runtime. Every
   * adapter reaches here through `start()`, and `stop()` below ends it, so the
   * timer's life is exactly the server's.
   *
   * Without a key-value client the composition returns no queue and no worker,
   * and this does nothing — the service keeps its previous behaviour of
   * throwing and discarding.
   */
  private startDeadLetterReplay(): void {
    const worker = this.composeUsersModule().deadLetterWorker;
    if (!worker) return;
    worker.start();
  }

  public async stop(): Promise<void> {
    // Before the clients close, or the drain would run against a disconnected
    // store and report a failure that means nothing.
    this.usersComposition?.deadLetterWorker?.stop();
    if (this.keyValueStorageClient) {
      await this.keyValueStorageClient.disconnect();
      // this.keyValueStorageClient = undefined;
    }
    // quit db
    // quit all
    await this.databaseClient.disconnect();
    // process.exit(0);
    await this.server.stop();
  }

  public async seedData(): Promise<void> {
    await this.seedOrganizations();
    await this.seedUsers();
  }

  public async purgeTombstones(options: {
    commit?: boolean;
    olderThanDays?: number;
    protectSeed?: boolean;
    now?: Date;
  } = {}) {
    const excludeIds = options.protectSeed === false
      ? []
      : [...seedOrganizationIds, ...seedUserIds];
    return purgeUserAndOrganizationTombstones({
      userStore: this.databaseClient.stores.User,
      organizationStore: this.databaseClient.stores.Organization,
      ledger: entityIdLedger,
      now: options.now,
      olderThanDays: options.olderThanDays,
      commit: options.commit === true,
      excludeIds
    });
  }

  /**
   * Seeded one at a time, on purpose (JUM-687).
   *
   * This used to run every create concurrently through `Promise.all`. Seeding a
   * handful of fixtures is not a throughput path — the concurrency bought
   * nothing and put several writers on the same organization record at once,
   * which is the shape the intermittent CI failures point at: a user that
   * exists but is not where a later request expects to find it.
   */
  public async seedOrganizations(): Promise<any[]> {
    const { organizationUseCases } = this.composeUsersModule();
    const seeded: any[] = [];

    for (const organization of organizations) {
      assertSeedIdNotPurged(entityIdLedger, 'Organization', organization.id);
      // eslint-disable-next-line no-await-in-loop
      const existing = await organizationUseCases.getOneById(organization.id);
      if (existing.result) {
        seeded.push(existing.result);
        // eslint-disable-next-line no-continue
        continue;
      }
      try {
        // eslint-disable-next-line no-await-in-loop
        const tombstone = await this.databaseClient.stores.Organization.getOneById(
          organization.id,
          { includeDeleted: true }
        );
        if (tombstone) {
          // eslint-disable-next-line no-await-in-loop
          await this.databaseClient.stores.Organization.update(organization.id, {
            ...tombstone,
            deletedAt: null
          });
          // eslint-disable-next-line no-await-in-loop
          const restored = await organizationUseCases.getOneById(organization.id);
          if (restored.result) seeded.push(restored.result);
          // eslint-disable-next-line no-continue
          continue;
        }
      } catch {
        // Record really missing — create below.
      }
      // eslint-disable-next-line no-await-in-loop
      const created = await organizationUseCases.create(organization as any);
      if (created.error) throw new Error((created.error as Error).message);
      if (!created.result) throw new Error('Organization seed failed');
      seeded.push(created.result);
    }

    return seeded;
  }

  /** Sequential for the same reason as `seedOrganizations` (JUM-687). */
  public async seedUsers(): Promise<IUser[]> {
    await this.seedOrganizations();
    const { userUseCases } = this.composeUsersModule();
    const seeded: IUser[] = [];

    for (const user of users) {
      assertSeedIdNotPurged(entityIdLedger, 'User', user.id);
      // eslint-disable-next-line no-await-in-loop
      const existing = await userUseCases.getOneById(user.id);
      if (existing.result) {
        seeded.push(existing.result);
        // eslint-disable-next-line no-continue
        continue;
      }
      try {
        // Tombstones hide from getOneById; the seed id must stay reserved.
        // eslint-disable-next-line no-await-in-loop
        const tombstone = await this.databaseClient.stores.User.getOneById(
          user.id,
          { includeDeleted: true }
        );
        if (tombstone) {
          // eslint-disable-next-line no-await-in-loop
          await this.databaseClient.stores.User.update(user.id, {
            ...tombstone,
            deletedAt: null
          });
          // eslint-disable-next-line no-await-in-loop
          const restored = await userUseCases.getOneById(user.id);
          if (restored.result) seeded.push(restored.result);
          // eslint-disable-next-line no-continue
          continue;
        }
      } catch {
        // Record really missing — create below.
      }
      // eslint-disable-next-line no-await-in-loop
      const newUser = await userUseCases.create(user);
      if (newUser.error) throw new Error((newUser.error as Error).message);
      if (!newUser.result) throw new Error('User seed failed');
      seeded.push(newUser.result);
    }

    return seeded;
  }

  public async deleteUsers(): Promise<boolean[]> {
    const { userUseCases } = this.composeUsersModule();
    const requests: Promise<boolean>[] = [];
    const allUsers = (await userUseCases.getAll({}, { page: 1, size: 1000 })).result || [];
    for (const user of allUsers) {
      requests.push(new Promise((resolve, reject) => {
        (async () => {
          try {
            const deletedUser = await userUseCases.delete(user.id);
            if (deletedUser.error) throw deletedUser.error;
            if (deletedUser.result === undefined) throw new Error('User delete failed');
            resolve(deletedUser.result);
          } catch (error: any) {
            // console.log(error.message);
            reject(new Error(error.message));
          }
        })();
      }));
    }
    return Promise.all(requests);
    // console.log('>>>> done');
  }

  private composeUsersModule(): ReturnType<typeof composeUsersAuthServices> {
    if (this.usersComposition) return this.usersComposition;

    if (!this.passwordCryptoService) {
      throw new Error('PasswordCryptoService is required to compose Users module.');
    }
    if (!this.mutexClient) {
      throw new Error('MutexService is required to compose Users module.');
    }
    if (!this.authService?.jwtService) {
      throw new Error('AuthService with JwtService is required to compose Users module.');
    }

    this.usersComposition = composeUsersAuthServices({
      databaseClient: this.databaseClient,
      passwordCryptoService: this.passwordCryptoService,
      mutexService: this.mutexClient,
      jwtService: this.authService.jwtService,
      keyValueStorageClient: this.keyValueStorageClient,
      eventBus: this.eventBus,
      messageMediator: this.messageMediator
    });
    return this.usersComposition;
  }
}

export default RestAPI;
