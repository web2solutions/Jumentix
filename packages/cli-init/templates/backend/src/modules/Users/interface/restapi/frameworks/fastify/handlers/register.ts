import sendErrorResponse from '@src/interface/HTTP/adapters/fastify/responses/sendErrorResponse';
import { RegisterRequestEvent } from '@src/modules/Users';

import type { FastifyReply, FastifyRequest } from 'fastify';

import type { EndPointFactory, IbaseHandler, IHandlerFactory } from '@src/interface/HTTP/ports';
import type { IRegisterRequest } from '@src/modules/Users';

const register: EndPointFactory = ({
  endPointConfig,
  controller
}: IHandlerFactory): IbaseHandler => ({
  path: '/auth/register',
  method: 'post',
  async handler(req: FastifyRequest, res: FastifyReply) {
    try {
      if (!controller?.register) {
        throw new Error('The register endpoint requires a controller implementing register.');
      }
      const { result, error } = await controller.register(
        new RegisterRequestEvent<IRegisterRequest>({
          input: req.body as IRegisterRequest,
          schemaOAS: endPointConfig
        })
      );
      if (error) throw error;
      res.code(201);
      return result;
    } catch (error: any) {
      return sendErrorResponse(error, res);
    }
  }
});

export default register;
