import { Request, Response } from 'restify';
import { sendErrorResponse } from '@src/interface/HTTP/adapters/restify/responses/sendErrorResponse';

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

    async handler(req: Request, res: Response) {
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
        res.status(200);
        return res.json(result);
      } catch (error: any) {
        return sendErrorResponse(error, res);
      }
    }
  };
};

export default getUsersMetrics;
