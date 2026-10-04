import sendErrorResponse from '@src/interface/HTTP/adapters/derby-js/responses/sendErrorResponse';
import OrganizationUpdateRequestEvent from '@src/modules/Users/events/OrganizationUpdateRequestEvent';

import type {
  DerbyJsRequest,
  DerbyJsResponse
} from '@src/interface/HTTP/adapters/derby-js/DerbyJsServer';
import type { EndPointFactory, IbaseHandler, IHandlerFactory } from '@src/interface/HTTP/ports';

const updateOrganization: EndPointFactory = ({
  endPointConfig,
  controller
}: IHandlerFactory): IbaseHandler => ({
  path: '/organizations/{id}',
  method: 'put',
  async handler(req: DerbyJsRequest, res: DerbyJsResponse) {
    try {
      const params = req.params as Record<string, any>;
      const domainEvent = new OrganizationUpdateRequestEvent({
        authorization: req.headers.authorization ?? '',
        input: req.body,
        schemaOAS: endPointConfig,
        params
      });
      if (!controller?.updateOrganization) {
        throw new Error(
          'The updateOrganization endpoint requires a controller implementing updateOrganization.'
        );
      }
      const { result, error } = await controller.updateOrganization(domainEvent);
      if (error) throw error;
      return res.status(200).json(result);
    } catch (error: any) {
      return sendErrorResponse(error, res);
    }
  }
});

export default updateOrganization;
