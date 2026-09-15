import { FastifyRequest, FastifyReply } from 'fastify';
import { sendErrorResponse } from '@src/interface/HTTP/adapters/fastify/responses/sendErrorResponse';

import type {
  IHandlerFactory,
  IbaseHandler,
  EndPointFactory
} from '@src/interface/HTTP/ports';

import { OrganizationGetMetricsRequestEvent } from '@src/modules/Users/events/OrganizationGetMetricsRequestEvent';

const getOrganizationsMetrics: EndPointFactory = (
  {
    endPointConfig,
    controller
  }: IHandlerFactory
): IbaseHandler => {
  return {
    path: '/organizations/metrics',
    method: 'get',

    async handler(req: FastifyRequest, res: FastifyReply) {
      try {
        const queryString = req.query as Record<string, any> || {};
        const { result, error } = await controller!.getOrganizationsMetrics!(
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
  };
};

export default getOrganizationsMetrics;
