import sendErrorResponse from '@src/interface/HTTP/adapters/feathers/responses/sendErrorResponse';
import { UserEmailDeleteRequestEvent } from '@src/modules/Users';

import type {
  FeathersRequest,
  FeathersResponse
} from '@src/interface/HTTP/adapters/feathers/FeathersServer';
import type { EndPointFactory, IbaseHandler, IHandlerFactory } from '@src/interface/HTTP/ports';
import type { UserController } from '@src/modules/Users';

const deleteEmail: EndPointFactory = ({
  endPointConfig,
  controller
}: IHandlerFactory): IbaseHandler => ({
  path: '/users/{id}/deleteEmail/{emailId}',
  method: 'delete',

  async handler(req: FeathersRequest, res: FeathersResponse) {
    try {
      const params = req.params as Record<string, any>;
      if (!controller) {
        throw new Error('The deleteEmail endpoint requires a controller.');
      }
      const { result, error } = await (controller as UserController).deleteEmail(
        new UserEmailDeleteRequestEvent({
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

export default deleteEmail;
