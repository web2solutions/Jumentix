import sendErrorResponse from '@src/interface/HTTP/adapters/adonis-js/responses/sendErrorResponse';
import UserUpdateRequestEvent from '@src/modules/Users/events/UserUpdateRequestEvent';

import type {
  AdonisJsRequest,
  AdonisJsResponse
} from '@src/interface/HTTP/adapters/adonis-js/AdonisJsServer';
import type { EndPointFactory, IbaseHandler, IHandlerFactory } from '@src/interface/HTTP/ports';

const update: EndPointFactory = ({
  endPointConfig,
  controller
}: IHandlerFactory): IbaseHandler => ({
  path: '/users/{id}',
  method: 'put',
  async handler(req: AdonisJsRequest, res: AdonisJsResponse) {
    try {
      const params = req.params as Record<string, any>;
      if (!controller?.update) {
        throw new Error('The update endpoint requires a controller implementing update.');
      }
      const { result, error } = await controller.update(
        new UserUpdateRequestEvent({
          authorization: req.headers.authorization ?? '',
          input: req.body,
          schemaOAS: endPointConfig,
          params
        })
      );
      if (error) throw error;
      return res.status(200).json(result);
    } catch (error: any) {
      return sendErrorResponse(error, res);
    }
  }
});

export default update;
