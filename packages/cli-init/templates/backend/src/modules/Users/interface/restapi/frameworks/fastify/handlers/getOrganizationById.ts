import sendErrorResponse from '@src/interface/HTTP/adapters/fastify/responses/sendErrorResponse';
import OrganizationGetOneRequestEvent from '@src/modules/Users/events/OrganizationGetOneRequestEvent';

import type { FastifyReply, FastifyRequest } from 'fastify';

import type { EndPointFactory, IbaseHandler, IHandlerFactory } from '@src/interface/HTTP/ports';

const getOrganizationById: EndPointFactory = ({
  endPointConfig,
  controller
}: IHandlerFactory): IbaseHandler => ({
  path: '/organizations/{id}',
  method: 'get',
  async handler(req: FastifyRequest, res: FastifyReply) {
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
      res.code(200);
      return result;
    } catch (error: any) {
      return sendErrorResponse(error, res);
    }
  }
});

export default getOrganizationById;
