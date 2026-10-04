import sendErrorResponse from '@src/interface/HTTP/adapters/adonis-js/responses/sendErrorResponse';
import UserDeleteRequestEvent from '@src/modules/Users/events/UserDeleteRequestEvent';

import type {
  AdonisJsRequest,
  AdonisJsResponse
} from '@src/interface/HTTP/adapters/adonis-js/AdonisJsServer';
import type { EndPointFactory, IbaseHandler, IHandlerFactory } from '@src/interface/HTTP/ports';

const deleteOne: EndPointFactory = ({
  endPointConfig,
  controller
}: IHandlerFactory): IbaseHandler => ({
  path: '/users/{id}',
  method: 'delete',
  async handler(req: AdonisJsRequest, res: AdonisJsResponse) {
    try {
      const params = req.params as Record<string, any>;
      if (!controller?.delete) {
        throw new Error('The deleteOne endpoint requires a controller implementing delete.');
      }
      const { result, error } = await controller.delete(
        new UserDeleteRequestEvent({
          authorization: req.headers.authorization ?? '',
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

export default deleteOne;
