import sendErrorResponse from '@src/interface/HTTP/adapters/derby-js/responses/sendErrorResponse';
import OrganizationDeleteRequestEvent from '@src/modules/Users/events/OrganizationDeleteRequestEvent';

import type {
  DerbyJsRequest,
  DerbyJsResponse
} from '@src/interface/HTTP/adapters/derby-js/DerbyJsServer';
import type { EndPointFactory, IbaseHandler, IHandlerFactory } from '@src/interface/HTTP/ports';

const deleteOrganization: EndPointFactory = ({
  endPointConfig,
  controller
}: IHandlerFactory): IbaseHandler => ({
  path: '/organizations/{id}',
  method: 'delete',
  async handler(req: DerbyJsRequest, res: DerbyJsResponse) {
    try {
      const params = req.params as Record<string, any>;
      const domainEvent = new OrganizationDeleteRequestEvent({
        authorization: req.headers.authorization ?? '',
        schemaOAS: endPointConfig,
        params
      });
      if (!controller?.deleteOrganization) {
        throw new Error(
          'The deleteOrganization endpoint requires a controller implementing deleteOrganization.'
        );
      }
      const { result, error } = await controller.deleteOrganization(domainEvent);
      if (error) throw error;
      return res.status(200).json(result);
    } catch (error: any) {
      return sendErrorResponse(error, res);
    }
  }
});

export default deleteOrganization;
