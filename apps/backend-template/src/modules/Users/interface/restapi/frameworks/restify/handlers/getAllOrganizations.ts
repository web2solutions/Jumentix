import sendErrorResponse from '@src/interface/HTTP/adapters/restify/responses/sendErrorResponse';
import OrganizationGetAllRequestEvent from '@src/modules/Users/events/OrganizationGetAllRequestEvent';

import type { Request, Response } from 'restify';

import type { EndPointFactory, IbaseHandler, IHandlerFactory } from '@src/interface/HTTP/ports';

const getAllOrganizations: EndPointFactory = ({
  endPointConfig,
  controller
}: IHandlerFactory): IbaseHandler => ({
  path: '/organizations',
  method: 'get',
  async handler(req: Request, res: Response) {
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
      return res.json(200, {
        result,
        error,
        page,
        size,
        total
      });
    } catch (error: any) {
      return sendErrorResponse(error, res);
    }
  }
});

export default getAllOrganizations;
