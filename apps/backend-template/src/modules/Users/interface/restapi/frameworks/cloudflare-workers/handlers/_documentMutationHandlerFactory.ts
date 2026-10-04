import { formatErrorMessage, toHttpStatus } from '@src/shared/utils';

import type { BaseError, EErrorStringCodes } from '@src/infra/exceptions';
import type {
  CloudflareWorkersRequest,
  CloudflareWorkersResponse
} from '@src/interface/HTTP/adapters/cloudflare-workers/cloudflare-workers';
import type { EndPointFactory, IbaseHandler, IHandlerFactory } from '@src/interface/HTTP/ports';
import type BaseDomainEvent from '@src/modules/port/BaseDomainEvent';
import type { UserController } from '@src/modules/Users';

type ControllerMethod = 'createDocument' | 'updateDocument' | 'deleteDocument';

interface DocumentMutationHandlerFactoryConfig {
  path: string;
  method: IbaseHandler['method'];
  statusCode: number;
  EventClass: new (message: Record<string, any>) => BaseDomainEvent;
  controllerMethod: ControllerMethod;
  withBody?: boolean;
}

function sendErrorResponse(error: BaseError, res: CloudflareWorkersResponse) {
  return res.status(toHttpStatus(error.code as EErrorStringCodes) || 500).json({
    message: formatErrorMessage(error),
    error
  });
}

const createDocumentMutationHandler = (
  config: DocumentMutationHandlerFactoryConfig
): EndPointFactory => {
  const { path, method, statusCode, EventClass, controllerMethod, withBody = true } = config;

  return ({ endPointConfig, controller }: IHandlerFactory): IbaseHandler => ({
    path,
    method,
    async handler(req: CloudflareWorkersRequest, res: CloudflareWorkersResponse) {
      try {
        const params = (req.params || {}) as Record<string, any>;
        const domainEvent = new EventClass({
          authorization: req.headers?.authorization ?? '',
          params,
          input: withBody ? req.body : undefined,
          schemaOAS: endPointConfig
        });
        if (!controller) {
          throw new Error('The _documentMutationHandlerFactory endpoint requires a controller.');
        }
        const { result, error } = await (controller as UserController)[controllerMethod](
          domainEvent
        );
        if (error) throw error;
        return res.status(statusCode).json(result);
      } catch (error: any) {
        return sendErrorResponse(error, res);
      }
    }
  });
};

export default createDocumentMutationHandler;
