import sendErrorResponse from '@src/interface/HTTP/adapters/express/responses/sendErrorResponse';

import type { Request, Response } from 'express';

import type { EndPointFactory, IbaseHandler, IHandlerFactory } from '@src/interface/HTTP/ports';
import type BaseDomainEvent from '@src/modules/port/BaseDomainEvent';
import type { OrganizationController } from '@src/modules/Users';

type ControllerMethod =
  | 'createOrganizationAddress'
  | 'updateOrganizationAddress'
  | 'deleteOrganizationAddress'
  | 'createOrganizationPhone'
  | 'updateOrganizationPhone'
  | 'deleteOrganizationPhone'
  | 'createOrganizationEmail'
  | 'updateOrganizationEmail'
  | 'deleteOrganizationEmail';

interface OrganizationMutationHandlerFactoryConfig {
  path: string;
  method: IbaseHandler['method'];
  statusCode: number;
  EventClass: new (message: Record<string, any>) => BaseDomainEvent;
  controllerMethod: ControllerMethod;
  withBody?: boolean;
}

const createOrganizationMutationHandler = (
  config: OrganizationMutationHandlerFactoryConfig
): EndPointFactory => {
  const { path, method, statusCode, EventClass, controllerMethod, withBody = true } = config;

  return ({ endPointConfig, controller }: IHandlerFactory): IbaseHandler => ({
    path,
    method,
    async handler(req: Request, res: Response) {
      try {
        const params = req.params as Record<string, any>;
        const domainEvent = new EventClass({
          authorization: req.headers.authorization ?? '',
          params,
          input: withBody ? req.body : undefined,
          schemaOAS: endPointConfig
        });
        if (!controller) {
          throw new Error(
            'The _organizationMutationHandlerFactory endpoint requires a controller.'
          );
        }
        const { result, error } = await (controller as OrganizationController)[controllerMethod](
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

export default createOrganizationMutationHandler;
