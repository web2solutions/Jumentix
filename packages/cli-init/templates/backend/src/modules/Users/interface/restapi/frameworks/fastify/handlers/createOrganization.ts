import sendErrorResponse from '@src/interface/HTTP/adapters/fastify/responses/sendErrorResponse';
import OrganizationCreateRequestEvent from '@src/modules/Users/events/OrganizationCreateRequestEvent';

import type { FastifyReply, FastifyRequest } from 'fastify';

import type { EndPointFactory, IbaseHandler, IHandlerFactory } from '@src/interface/HTTP/ports';

const createOrganization: EndPointFactory = ({
  endPointConfig,
  controller
}: IHandlerFactory): IbaseHandler => ({
  path: '/organizations',
  method: 'post',
  async handler(req: FastifyRequest, res: FastifyReply) {
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
      res.code(201);
      return result;
    } catch (error: any) {
      return sendErrorResponse(error, res);
    }
  }
});

export default createOrganization;
