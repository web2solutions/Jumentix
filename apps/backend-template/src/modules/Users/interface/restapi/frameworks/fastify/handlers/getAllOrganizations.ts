import sendErrorResponse from '@src/interface/HTTP/adapters/fastify/responses/sendErrorResponse';
import OrganizationGetAllRequestEvent from '@src/modules/Users/events/OrganizationGetAllRequestEvent';

import type { FastifyReply, FastifyRequest } from 'fastify';

import type { EndPointFactory, IbaseHandler, IHandlerFactory } from '@src/interface/HTTP/ports';

const getAllOrganizations: EndPointFactory = ({
  endPointConfig,
  controller
}: IHandlerFactory): IbaseHandler => ({
  path: '/organizations',
  method: 'get',
  async handler(req: FastifyRequest, res: FastifyReply) {
    try {
      const queryString = (req.query as Record<string, any>) || {};
      if (!queryString.page) queryString.page = 1;
      if (!controller?.getAllOrganizations) {
        throw new Error(
          'The getAllOrganizations endpoint requires a controller implementing getAllOrganizations.'
        );
      }
      const { result, error, page, size, total } = await controller.getAllOrganizations(
        new OrganizationGetAllRequestEvent({
          authorization: req.headers.authorization ?? '',
          schemaOAS: endPointConfig,
          queryString
        })
      );
      if (error) throw error;
      res.code(200);
      return {
        result,
        error,
        page,
        size,
        total
      };
    } catch (error: any) {
      return sendErrorResponse(error, res);
    }
  }
});

export default getAllOrganizations;
