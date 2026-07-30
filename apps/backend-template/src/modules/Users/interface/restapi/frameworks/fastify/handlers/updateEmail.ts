import { FastifyRequest, FastifyReply } from 'fastify';
import { sendErrorResponse } from '@src/interface/HTTP/adapters/fastify/responses/sendErrorResponse';

import type {
  IHandlerFactory
} from '@src/interface/HTTP/ports';
import type {
  IbaseHandler,
  EndPointFactory
} from '@src/interface/HTTP/ports';

import type { RequestUpdateEmail } from '@src/modules/Users';
import { UserEmailUpdateRequestEvent, UserController } from '@src/modules/Users';

const updateEmail: EndPointFactory = (
  {
    endPointConfig,
    controller
  }: IHandlerFactory
): IbaseHandler => {
  return {
    path: '/users/{id}/updateEmail/{emailId}',
    method: 'put',

    async handler(req: FastifyRequest, res: FastifyReply) {
      try {
        const params = JSON.parse(JSON.stringify(req.params));
        const { result, error } = await (controller! as UserController)
          .updateEmail(new UserEmailUpdateRequestEvent({
            authorization: req.headers.authorization ?? '',
            params,
            input: req.body as RequestUpdateEmail,
            schemaOAS: endPointConfig
          }));
        if (error) throw error;
        res.code(200);
        return result;
      } catch (error: any) {
        return sendErrorResponse(error, res);
      }
    }
  };
};

export default updateEmail;
