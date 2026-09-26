import sendErrorResponse from '@src/interface/HTTP/adapters/vercel-functions/responses/sendErrorResponse';
import { UserPasswordUpdateRequestEvent } from '@src/modules/Users';

import type {
  VercelFunctionsRequest,
  VercelFunctionsResponse
} from '@src/interface/HTTP/adapters/vercel-functions/vercel-functions';
import type { EndPointFactory, IbaseHandler, IHandlerFactory } from '@src/interface/HTTP/ports';
import type { RequestUpdatePassword, UserController } from '@src/modules/Users';

const updatePassword: EndPointFactory = ({
  endPointConfig,
  controller
}: IHandlerFactory): IbaseHandler => ({
  path: '/users/{id}/updatePassword',
  method: 'put',

  async handler(req: VercelFunctionsRequest, res: VercelFunctionsResponse) {
    try {
      const params = req.params as Record<string, any>;
      if (!controller) {
        throw new Error('The updatePassword endpoint requires a controller.');
      }
      const { result, error } = await (controller as UserController).updatePassword(
        new UserPasswordUpdateRequestEvent({
          authorization: req.headers.authorization ?? '',
          params,
          input: req.body as RequestUpdatePassword,
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

export default updatePassword;
