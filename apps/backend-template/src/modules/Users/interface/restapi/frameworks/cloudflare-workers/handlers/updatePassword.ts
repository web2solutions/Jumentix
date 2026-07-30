import type { CloudflareWorkersRequest, CloudflareWorkersResponse } from '@src/interface/HTTP/adapters/cloudflare-workers/cloudflare-workers';
import { sendErrorResponse } from '@src/interface/HTTP/adapters/cloudflare-workers/responses/sendErrorResponse';

import type {
  IHandlerFactory
} from '@src/interface/HTTP/ports';
import type {
  IbaseHandler,
  EndPointFactory
} from '@src/interface/HTTP/ports';

import type { RequestUpdatePassword } from '@src/modules/Users';
import { UserController, UserPasswordUpdateRequestEvent } from '@src/modules/Users';

const updatePassword: EndPointFactory = (
  {
    endPointConfig,
    controller
  }: IHandlerFactory
): IbaseHandler => {
  return {
    path: '/users/{id}/updatePassword',
    method: 'put',

    async handler(req: CloudflareWorkersRequest, res: CloudflareWorkersResponse) {
      try {
        const params = req.params as Record<string, any>;
        const { result, error } = await (controller! as UserController)
          .updatePassword(new UserPasswordUpdateRequestEvent({
            authorization: req.headers.authorization ?? '',
            params,
            input: req.body as RequestUpdatePassword,
            schemaOAS: endPointConfig
          }));
        if (error) throw error;
        return res.status(200).json(result);
      } catch (error: any) {
        return sendErrorResponse(error, res);
      }
    }
  };
};

export default updatePassword;
