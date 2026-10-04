import sendErrorResponse from '@src/interface/HTTP/adapters/adonis-js/responses/sendErrorResponse';
import { UserEmailCreateRequestEvent } from '@src/modules/Users';

import type {
  AdonisJsRequest,
  AdonisJsResponse
} from '@src/interface/HTTP/adapters/adonis-js/AdonisJsServer';
import type { EndPointFactory, IbaseHandler, IHandlerFactory } from '@src/interface/HTTP/ports';
import type { RequestCreateEmail, UserController } from '@src/modules/Users';

const createEmail: EndPointFactory = ({
  endPointConfig,
  controller
}: IHandlerFactory): IbaseHandler => ({
  path: '/users/{id}/createEmail',
  method: 'post',
  async handler(req: AdonisJsRequest, res: AdonisJsResponse) {
    try {
      const params = req.params as Record<string, any>;
      if (!controller) {
        throw new Error('The createEmail endpoint requires a controller.');
      }
      const { result, error } = await (controller as UserController).createEmail(
        new UserEmailCreateRequestEvent({
          authorization: req.headers.authorization ?? '',
          params,
          input: req.body as RequestCreateEmail,
          schemaOAS: endPointConfig
        })
      );
      if (error) throw error;
      return res.status(201).json(result);
    } catch (error: any) {
      return sendErrorResponse(error, res);
    }
  }
});

export default createEmail;
