import sendErrorResponse from '@src/interface/HTTP/adapters/cloudflare-workers/responses/sendErrorResponse';
import { UserPhoneDeleteRequestEvent } from '@src/modules/Users';

import type {
  CloudflareWorkersRequest,
  CloudflareWorkersResponse
} from '@src/interface/HTTP/adapters/cloudflare-workers/cloudflare-workers';
import type { EndPointFactory, IbaseHandler, IHandlerFactory } from '@src/interface/HTTP/ports';
import type { UserController } from '@src/modules/Users';

const deletePhone: EndPointFactory = ({
  endPointConfig,
  controller
}: IHandlerFactory): IbaseHandler => ({
  path: '/users/{id}/deletePhone/{phoneId}',
  method: 'delete',

  async handler(req: CloudflareWorkersRequest, res: CloudflareWorkersResponse) {
    try {
      const params = req.params as Record<string, any>;
      if (!controller) {
        throw new Error('The deletePhone endpoint requires a controller.');
      }
      const { result, error } = await (controller as UserController).deletePhone(
        new UserPhoneDeleteRequestEvent({
          authorization: req.headers.authorization ?? '',
          params,
          schemaOAS: endPointConfig
        })
      );
      if (error) throw error;
      return res.status(200).json(result);
    } catch (error: any) {
      return sendErrorResponse(error, res);
    }
  }
});

export default deletePhone;
