import sendErrorResponse from '@src/interface/HTTP/adapters/derby-js/responses/sendErrorResponse';
import UserGetAllRequestEvent from '@src/modules/Users/events/UserGetAllRequestEvent';

import type {
  DerbyJsRequest,
  DerbyJsResponse
} from '@src/interface/HTTP/adapters/derby-js/DerbyJsServer';
import type { EndPointFactory, IbaseHandler, IHandlerFactory } from '@src/interface/HTTP/ports';

const getAll: EndPointFactory = ({
  endPointConfig,
  controller
}: IHandlerFactory): IbaseHandler => ({
  path: '/users',
  method: 'get',

  async handler(req: DerbyJsRequest, res: DerbyJsResponse) {
    try {
      const queryString = (req.query as Record<string, any>) || {};
      if (!queryString.page) queryString.page = 1;
      if (!controller?.getAll) {
        throw new Error('The getAll endpoint requires a controller implementing getAll.');
      }
      const { result, error, page, size, total } = await controller.getAll(
        new UserGetAllRequestEvent({
          authorization: req.headers.authorization ?? '',
          schemaOAS: endPointConfig,
          queryString
        })
      );
      // console.log({ error });
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

export default getAll;
