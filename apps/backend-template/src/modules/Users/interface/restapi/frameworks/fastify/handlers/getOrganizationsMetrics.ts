import sendErrorResponse from '@src/interface/HTTP/adapters/fastify/responses/sendErrorResponse';
import OrganizationGetMetricsRequestEvent from '@src/modules/Users/events/OrganizationGetMetricsRequestEvent';

import type { FastifyReply, FastifyRequest } from 'fastify';

import type { EndPointFactory, IbaseHandler, IHandlerFactory } from '@src/interface/HTTP/ports';

const getOrganizationsMetrics: EndPointFactory = ({
  endPointConfig,
  controller
}: IHandlerFactory): IbaseHandler => ({
  path: '/organizations/metrics',
  method: 'get',

  async handler(req: FastifyRequest, res: FastifyReply) {
    try {
      const queryString = (req.query as Record<string, any>) || {};
      if (!controller?.getOrganizationsMetrics) {
        throw new Error(
          'The getOrganizationsMetrics endpoint requires a controller implementing getOrganizationsMetrics.'
        );
      }
      const { result, error } = await controller.getOrganizationsMetrics(
        new OrganizationGetMetricsRequestEvent({
          authorization: req.headers.authorization ?? '',
          schemaOAS: endPointConfig,
          queryString
        })
      );
      if (error) throw error;
      res.code(200);
      return result;
    } catch (error: any) {
      return sendErrorResponse(error, res);
    }
  }
});

export default getOrganizationsMetrics;
