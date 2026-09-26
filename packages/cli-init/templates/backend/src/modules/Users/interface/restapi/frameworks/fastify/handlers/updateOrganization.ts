import sendErrorResponse from '@src/interface/HTTP/adapters/fastify/responses/sendErrorResponse';
import OrganizationUpdateRequestEvent from '@src/modules/Users/events/OrganizationUpdateRequestEvent';

import type { FastifyReply, FastifyRequest } from 'fastify';

import type { EndPointFactory, IbaseHandler, IHandlerFactory } from '@src/interface/HTTP/ports';

const updateOrganization: EndPointFactory = ({
  endPointConfig,
  controller
}: IHandlerFactory): IbaseHandler => ({
  path: '/organizations/{id}',
  method: 'put',
  async handler(req: FastifyRequest, res: FastifyReply) {
    try {
      const params = req.params as Record<string, any>;
      const domainEvent = new OrganizationUpdateRequestEvent({
        authorization: req.headers.authorization ?? '',
        input: req.body,
        schemaOAS: endPointConfig,
        params
      });
      if (!controller?.updateOrganization) {
        throw new Error(
          'The updateOrganization endpoint requires a controller implementing updateOrganization.'
        );
      }
      const { result, error } = await controller.updateOrganization(domainEvent);
      if (error) throw error;
      res.code(200);
      return result;
    } catch (error: any) {
      return sendErrorResponse(error, res);
    }
  }
});

export default updateOrganization;
