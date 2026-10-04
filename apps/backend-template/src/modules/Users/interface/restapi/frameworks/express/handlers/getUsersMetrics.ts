import sendErrorResponse from '@src/interface/HTTP/adapters/express/responses/sendErrorResponse';
import UserGetMetricsRequestEvent from '@src/modules/Users/events/UserGetMetricsRequestEvent';

import type { Request, Response } from 'express';

import type { EndPointFactory, IbaseHandler, IHandlerFactory } from '@src/interface/HTTP/ports';

const getUsersMetrics: EndPointFactory = ({
  endPointConfig,
  controller
}: IHandlerFactory): IbaseHandler => ({
  path: '/users/metrics',
  method: 'get',

  async handler(req: Request, res: Response) {
    try {
      const queryString = (req.query as Record<string, any>) || {};
      if (!controller?.getUsersMetrics) {
        throw new Error(
          'The getUsersMetrics endpoint requires a controller implementing getUsersMetrics.'
        );
      }
      const { result, error } = await controller.getUsersMetrics(
        new UserGetMetricsRequestEvent({
          authorization: req.headers.authorization ?? '',
          schemaOAS: endPointConfig,
          queryString
        })
      );
      if (error) throw error;
      return res.status(200).json(result);
    } catch (error: any) {
      return sendErrorResponse(error, res);
    }
  }
});

export default getUsersMetrics;
