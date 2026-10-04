import sendErrorResponse from '@src/interface/HTTP/adapters/fastify/responses/sendErrorResponse';
import { UserCreateRequestEvent } from '@src/modules/Users';

import type { FastifyReply, FastifyRequest } from 'fastify';

import type { EndPointFactory, IbaseHandler, IHandlerFactory } from '@src/interface/HTTP/ports';

const create: EndPointFactory = ({
  endPointConfig,
  controller
}: IHandlerFactory): IbaseHandler => ({
  path: '/users',
  method: 'post',
  async handler(req: FastifyRequest, res: FastifyReply) {
    try {
      if (!controller?.create) {
        throw new Error('The create endpoint requires a controller implementing create.');
      }
      const { result, error } = await controller.create(
        new UserCreateRequestEvent({
          authorization: req.headers.authorization ?? '',
          input: req.body,
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

export default create;
