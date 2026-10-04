import sendErrorResponse from '@src/interface/HTTP/adapters/express/responses/sendErrorResponse';
import OrganizationCreateRequestEvent from '@src/modules/Users/events/OrganizationCreateRequestEvent';

import type { Request, Response } from 'express';

import type { EndPointFactory, IbaseHandler, IHandlerFactory } from '@src/interface/HTTP/ports';

const createOrganization: EndPointFactory = ({
  endPointConfig,
  controller
}: IHandlerFactory): IbaseHandler => ({
  path: '/organizations',
  method: 'post',
  async handler(req: Request, res: Response) {
    try {
      const domainEvent = new OrganizationCreateRequestEvent({
        authorization: req.headers.authorization ?? '',
        input: req.body,
        schemaOAS: endPointConfig
      });
      if (!controller?.createOrganization) {
        throw new Error(
          'The createOrganization endpoint requires a controller implementing createOrganization.'
        );
      }
      const { result, error } = await controller.createOrganization(domainEvent);
      if (error) throw error;
      return res.status(201).json(result);
    } catch (error: any) {
      return sendErrorResponse(error, res);
    }
  }
});

export default createOrganization;
