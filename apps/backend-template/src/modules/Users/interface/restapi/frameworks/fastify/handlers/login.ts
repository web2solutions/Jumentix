import sendErrorResponse from '@src/interface/HTTP/adapters/fastify/responses/sendErrorResponse';
import { LoginRequestEvent } from '@src/modules/Users';

import type { FastifyReply, FastifyRequest } from 'fastify';

import type { EndPointFactory, IbaseHandler, IHandlerFactory } from '@src/interface/HTTP/ports';
import type { ILoginRequest } from '@src/modules/Users';

const login: EndPointFactory = ({ endPointConfig, controller }: IHandlerFactory): IbaseHandler => ({
  path: '/auth/login',
  method: 'post',
  async handler(req: FastifyRequest, res: FastifyReply) {
    try {
      if (!controller?.login) {
        throw new Error('The login endpoint requires a controller implementing login.');
      }
      const { result, error } = await controller.login(
        new LoginRequestEvent<ILoginRequest>({
          input: req.body as ILoginRequest,
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

export default login;
