import sendErrorResponse from '@src/interface/HTTP/adapters/fastify/responses/sendErrorResponse';
import { UserGetOneRequestEvent } from '@src/modules/Users';

import type { FastifyReply, FastifyRequest } from 'fastify';

import type { EndPointFactory, IbaseHandler, IHandlerFactory } from '@src/interface/HTTP/ports';

const getOneById: EndPointFactory = ({
  endPointConfig,
  controller
}: IHandlerFactory): IbaseHandler => ({
  path: '/users/{id}',
  method: 'get',

  async handler(req: FastifyRequest, res: FastifyReply) {
    try {
      const params = JSON.parse(JSON.stringify(req.params));
      if (!controller?.getOneById) {
        throw new Error('The getOneById endpoint requires a controller implementing getOneById.');
      }
      const { result, error } = await controller.getOneById(
        new UserGetOneRequestEvent({
          authorization: req.headers.authorization ?? '',
          schemaOAS: endPointConfig,
          params
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

export default getOneById;
