import sendErrorResponse from '@src/interface/HTTP/adapters/fastify/responses/sendErrorResponse';
import { UserPhoneDeleteRequestEvent } from '@src/modules/Users';

import type { FastifyReply, FastifyRequest } from 'fastify';

import type { EndPointFactory, IbaseHandler, IHandlerFactory } from '@src/interface/HTTP/ports';
import type { UserController } from '@src/modules/Users';

const deletePhone: EndPointFactory = ({
  endPointConfig,
  controller
}: IHandlerFactory): IbaseHandler => ({
  path: '/users/{id}/deletePhone/{phoneId}',
  method: 'delete',

  async handler(req: FastifyRequest, res: FastifyReply) {
    try {
      const params = JSON.parse(JSON.stringify(req.params));
      if (!controller) {
        throw new Error('The deletePhone endpoint requires a controller.');
      }
      const { result, error } = await (controller as UserController).deletePhone(
        new UserPhoneDeleteRequestEvent({
          authorization: req.headers.authorization ?? '',
          params,
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

export default deletePhone;
