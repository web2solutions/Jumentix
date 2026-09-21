import { OpenAPIV3 } from 'openapi-types';
import type { IDatabaseClient } from '@src/infra/persistence/port/IDatabaseClient';
import type { IMutexService } from '@src/infra/mutex/port/IMutexService';
import type { IAuthService } from '@src/modules/Users/service/ports/IAuthService';
import type { IController } from './IController';

export interface IHandlerFactory {
    databaseClient: IDatabaseClient;
    mutexService?: IMutexService;
    endPointConfig: Record<string, any>;
    spec: OpenAPIV3.Document;
    version?: string;
    apiDocs?: Map<string, OpenAPIV3.Document>;
    authService?: IAuthService;
    controller?: IController;
}
