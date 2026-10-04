import sendErrorResponse from '@src/interface/HTTP/adapters/fastify/responses/sendErrorResponse';
import { UpdatePasswordRequestEvent } from '@src/modules/Users';

import type { FastifyReply, FastifyRequest } from 'fastify';

import type { EndPointFactory, IbaseHandler, IHandlerFactory } from '@src/interface/HTTP/ports';
import type { IUpdatePasswordRequest } from '@src/modules/Users';

const updateUserPassword: EndPointFactory = ({
  endPointConfig,
  controller
}: IHandlerFactory): IbaseHandler => ({
  path: '/auth/updateUserPassword',
  method: 'post',
  async handler(req: FastifyRequest, res: FastifyReply) {
    try {
      if (!controller?.updatePassword) {
        throw new Error(
          'The updateUserPassword endpoint requires a controller implementing updatePassword.'
        );
      }
      const { result, error } = await controller.updatePassword(
        new UpdatePasswordRequestEvent<IUpdatePasswordRequest>({
          authorization: req.headers.authorization ?? '',
          input: req.body as IUpdatePasswordRequest,
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

export default updateUserPassword;
