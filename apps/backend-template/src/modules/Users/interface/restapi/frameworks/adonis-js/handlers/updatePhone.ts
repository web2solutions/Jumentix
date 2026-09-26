import sendErrorResponse from '@src/interface/HTTP/adapters/adonis-js/responses/sendErrorResponse';
import { UserPhoneUpdateRequestEvent } from '@src/modules/Users';

import type {
  AdonisJsRequest,
  AdonisJsResponse
} from '@src/interface/HTTP/adapters/adonis-js/AdonisJsServer';
import type { EndPointFactory, IbaseHandler, IHandlerFactory } from '@src/interface/HTTP/ports';
import type { RequestUpdatePhone, UserController } from '@src/modules/Users';

const updatePhone: EndPointFactory = ({
  endPointConfig,
  controller
}: IHandlerFactory): IbaseHandler => ({
  path: '/users/{id}/updatePhone/{phoneId}',
  method: 'put',

  async handler(req: AdonisJsRequest, res: AdonisJsResponse) {
    try {
      const params = req.params as Record<string, any>;
      if (!controller) {
        throw new Error('The updatePhone endpoint requires a controller.');
      }
      const { result, error } = await (controller as UserController).updatePhone(
        new UserPhoneUpdateRequestEvent({
          authorization: req.headers.authorization ?? '',
          params,
          input: req.body as RequestUpdatePhone,
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

export default updatePhone;
