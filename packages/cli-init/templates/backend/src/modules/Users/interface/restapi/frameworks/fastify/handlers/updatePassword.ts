import sendErrorResponse from '@src/interface/HTTP/adapters/fastify/responses/sendErrorResponse';
import { UserPasswordUpdateRequestEvent } from '@src/modules/Users';

import type { FastifyReply, FastifyRequest } from 'fastify';

import type { EndPointFactory, IbaseHandler, IHandlerFactory } from '@src/interface/HTTP/ports';
import type { RequestUpdatePassword, UserController } from '@src/modules/Users';

const updatePassword: EndPointFactory = ({
  endPointConfig,
  controller
}: IHandlerFactory): IbaseHandler => ({
  path: '/users/{id}/updatePassword',
  method: 'put',

  async handler(req: FastifyRequest, res: FastifyReply) {
    try {
      const params = JSON.parse(JSON.stringify(req.params));
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
      res.code(200);
      return result;
    } catch (error: any) {
      return sendErrorResponse(error, res);
    }
  }
});

export default updatePassword;
