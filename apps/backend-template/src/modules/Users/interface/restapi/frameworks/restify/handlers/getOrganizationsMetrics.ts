import sendErrorResponse from '@src/interface/HTTP/adapters/restify/responses/sendErrorResponse';
import OrganizationGetMetricsRequestEvent from '@src/modules/Users/events/OrganizationGetMetricsRequestEvent';

import type { Request, Response } from 'restify';

import type { EndPointFactory, IbaseHandler, IHandlerFactory } from '@src/interface/HTTP/ports';

const getOrganizationsMetrics: EndPointFactory = ({
  endPointConfig,
  controller
}: IHandlerFactory): IbaseHandler => ({
  path: '/organizations/metrics',
  method: 'get',

  async handler(req: Request, res: Response) {
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
      res.status(200);
      return res.json(result);
    } catch (error: any) {
      return sendErrorResponse(error, res);
    }
  }
});

export default getOrganizationsMetrics;
