import type { LoopBackRequest, LoopBackResponse } from '@src/interface/HTTP/adapters/loopback/LoopBackServer';
import { sendErrorResponse } from '@src/interface/HTTP/adapters/loopback/responses/sendErrorResponse';

import type {
  IHandlerFactory,
  IbaseHandler,
  EndPointFactory
} from '@src/interface/HTTP/ports';

import type { RequestUpdateEmail } from '@src/modules/Users';
import { UserController, UserEmailUpdateRequestEvent } from '@src/modules/Users';

const updateEmail: EndPointFactory = (
  {
    endPointConfig,
    controller
  }: IHandlerFactory
): IbaseHandler => {
  return {
    path: '/users/{id}/updateEmail/{emailId}',
    method: 'put',

    async handler(req: LoopBackRequest, res: LoopBackResponse) {
      try {
        const params = req.params as Record<string, any>;
        const { result, error } = await (controller! as UserController)
          .updateEmail(new UserEmailUpdateRequestEvent({
            authorization: req.headers.authorization ?? '',
            params,
            input: req.body as RequestUpdateEmail,
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

export default updateEmail;
