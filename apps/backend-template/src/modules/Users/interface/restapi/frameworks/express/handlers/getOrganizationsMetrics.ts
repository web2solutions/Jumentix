import { Request, Response } from 'express';
import { sendErrorResponse } from '@src/interface/HTTP/adapters/express/responses/sendErrorResponse';

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

    async handler(req: Request, res: Response) {
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
        return res.status(200).json(result);
      } catch (error: any) {
        return sendErrorResponse(error, res);
      }
    }
  };
};

export default getOrganizationsMetrics;
