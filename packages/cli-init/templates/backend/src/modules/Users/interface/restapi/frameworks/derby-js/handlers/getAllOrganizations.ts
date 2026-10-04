import sendErrorResponse from '@src/interface/HTTP/adapters/derby-js/responses/sendErrorResponse';
import OrganizationGetAllRequestEvent from '@src/modules/Users/events/OrganizationGetAllRequestEvent';

import type {
  DerbyJsRequest,
  DerbyJsResponse
} from '@src/interface/HTTP/adapters/derby-js/DerbyJsServer';
import type { EndPointFactory, IbaseHandler, IHandlerFactory } from '@src/interface/HTTP/ports';

const getAllOrganizations: EndPointFactory = ({
  endPointConfig,
  controller
}: IHandlerFactory): IbaseHandler => ({
  path: '/organizations',
  method: 'get',
  async handler(req: DerbyJsRequest, res: DerbyJsResponse) {
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
      return res.status(200).json({
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
