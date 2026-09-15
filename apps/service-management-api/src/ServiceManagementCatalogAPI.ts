/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from 'fs';
import path from 'path';
import YAML from 'yaml';
import { OpenAPIV3 } from 'openapi-types';

import { _API_PREFIX_ } from '@src/config/constants';
import { replaceVars } from '@src/shared/utils';
import type { IDatabaseClient } from '@src/infra/persistence/port/IDatabaseClient';
import type { IAuthService } from '@src/modules/Users';
import type { IEventBus, IMessageMediator } from '@src/modules/port';
import type { HTTPBaseServer, IbaseHandler } from '@src/interface/HTTP/ports';

import { CatalogController } from '@service-management-api/modules/Catalogs/adapters/in/http/controllers/CatalogController';
import { composeCatalogsServices } from '@service-management-api/modules/Catalogs';

import expressCreate from '@service-management-api/modules/Catalogs/interface/restapi/frameworks/express/handlers/createCatalog';
import expressDelete from '@service-management-api/modules/Catalogs/interface/restapi/frameworks/express/handlers/deleteCatalog';
import expressGetAll from '@service-management-api/modules/Catalogs/interface/restapi/frameworks/express/handlers/getAllCatalogs';
import expressGetOne from '@service-management-api/modules/Catalogs/interface/restapi/frameworks/express/handlers/getCatalogById';
import expressRestore from '@service-management-api/modules/Catalogs/interface/restapi/frameworks/express/handlers/restoreCatalog';
import expressUpdate from '@service-management-api/modules/Catalogs/interface/restapi/frameworks/express/handlers/updateCatalog';

export interface IServiceManagementCatalogAPIFactory<T> {
  databaseClient: IDatabaseClient;
  webServer: HTTPBaseServer<T>;
  authService: IAuthService;
  eventBus?: IEventBus;
  messageMediator?: IMessageMediator;
  specDir?: string;
}

const handlerFactoryByOperationId: Record<string, any> = {
  getAllCatalogs: expressGetAll,
  createCatalog: expressCreate,
  getCatalogById: expressGetOne,
  updateCatalog: expressUpdate,
  deleteCatalog: expressDelete,
  restoreCatalog: expressRestore
};

export class ServiceManagementCatalogAPI<T> {
  private readonly oas: Map<string, OpenAPIV3.Document> = new Map();

  public readonly server: HTTPBaseServer<T>;

  public readonly databaseClient: IDatabaseClient;

  private readonly authService: IAuthService;

  private readonly eventBus?: IEventBus;

  private readonly messageMediator?: IMessageMediator;

  private readonly specDir: string;

  private started = false;

  constructor(config: IServiceManagementCatalogAPIFactory<T>) {
    this.server = config.webServer;
    this.databaseClient = config.databaseClient;
    this.authService = config.authService;
    this.eventBus = config.eventBus;
    this.messageMediator = config.messageMediator;
    this.specDir = config.specDir || path.resolve(__dirname, '..', 'spec');
    this.buildWithOAS();
  }

  private buildWithOAS(): void {
    const specs = fs.readdirSync(this.specDir)
      .filter((specName) => specName.endsWith('.yml') || specName.endsWith('.yaml'));
    for (const specFileName of specs) {
      const file = fs.readFileSync(path.join(this.specDir, specFileName), 'utf8');
      const parsedSpec = YAML.parse(file);
      if (parsedSpec?.openapi && parsedSpec?.info?.version) {
        this.oas.set(parsedSpec.info.version, parsedSpec as OpenAPIV3.Document);
      }
    }
    this.buildEndPoints();
  }

  private buildEndPoints(): void {
    const { catalogUseCases } = composeCatalogsServices({
      databaseClient: this.databaseClient,
      eventBus: this.eventBus,
      messageMediator: this.messageMediator
    });
    for (const [version, spec] of this.oas) {
      const controller = new CatalogController({
        authService: this.authService,
        openApiSpecification: spec,
        databaseClient: this.databaseClient,
        catalogUseCases,
        messageMediator: this.messageMediator
      } as any);
      for (const routePath of Object.keys(spec.paths || {})) {
        const endPointConfigs: Record<string, any> = spec.paths[routePath] ?? {};
        for (const method of Object.keys(endPointConfigs)) {
          const endPointConfig = endPointConfigs[method];
          const factory = handlerFactoryByOperationId[endPointConfig.operationId];
          if (!factory) {
            throw new Error(`Service Management catalog handler not found for ${endPointConfig.operationId}.`);
          }
          const handler = factory({ endPointConfig, controller }) as IbaseHandler;
          this.server.endPointRegister({
            ...handler,
            path: `${_API_PREFIX_}/${version}${replaceVars(handler.path)}`
          });
        }
      }
    }
  }

  public async start(): Promise<void> {
    if (this.started) return;
    await this.databaseClient.connect();
    await this.server.start();
    this.started = true;
  }

  public async stop(): Promise<void> {
    await this.server.stop();
    await this.databaseClient.disconnect();
    this.started = false;
  }
}
