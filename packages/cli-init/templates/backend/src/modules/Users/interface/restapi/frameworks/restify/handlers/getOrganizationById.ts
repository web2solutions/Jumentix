import sendErrorResponse from '@src/interface/HTTP/adapters/restify/responses/sendErrorResponse';
import OrganizationGetOneRequestEvent from '@src/modules/Users/events/OrganizationGetOneRequestEvent';

import type { Request, Response } from 'restify';

import type { EndPointFactory, IbaseHandler, IHandlerFactory } from '@src/interface/HTTP/ports';

const getOrganizationById: EndPointFactory = ({
  endPointConfig,
  controller
}: IHandlerFactory): IbaseHandler => ({
  path: '/organizations/{id}',
  method: 'get',
  async handler(req: Request, res: Response) {
    try {
      const params = req.params as Record<string, any>;
      const domainEvent = new OrganizationGetOneRequestEvent({
        authorization: req.headers.authorization ?? '',
        schemaOAS: endPointConfig,
        params
      });
      if (!controller?.getOrganizationById) {
        throw new Error(
          'The getOrganizationById endpoint requires a controller implementing getOrganizationById.'
        );
      }
      const { result, error } = await controller.getOrganizationById(domainEvent);
      if (error) throw error;
      return res.json(200, result);
    } catch (error: any) {
      return sendErrorResponse(error, res);
    }
  }
});

export default getOrganizationById;
