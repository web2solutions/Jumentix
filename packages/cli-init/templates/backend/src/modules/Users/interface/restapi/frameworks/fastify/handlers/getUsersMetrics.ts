import { FastifyRequest, FastifyReply } from 'fastify';
import { sendErrorResponse } from '@src/interface/HTTP/adapters/fastify/responses/sendErrorResponse';

import type {
  IHandlerFactory,
  IbaseHandler,
  EndPointFactory
} from '@src/interface/HTTP/ports';

import { UserGetMetricsRequestEvent } from '@src/modules/Users/events/UserGetMetricsRequestEvent';

const getUsersMetrics: EndPointFactory = (
  {
    endPointConfig,
    controller
  }: IHandlerFactory
): IbaseHandler => {
  return {
    path: '/users/metrics',
    method: 'get',

    async handler(req: FastifyRequest, res: FastifyReply) {
      try {
        const queryString = req.query as Record<string, any> || {};
        const { result, error } = await controller!.getUsersMetrics!(
          new UserGetMetricsRequestEvent({
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

export default getUsersMetrics;
