import sendErrorResponse from '@src/interface/HTTP/adapters/fastify/responses/sendErrorResponse';

import { CatalogCreateRequestEvent } from '@service-management-api/modules/Catalogs';

import type { EndPointFactory, IbaseHandler, IHandlerFactory } from '@src/interface/HTTP/ports';
import type { FastifyReply, FastifyRequest } from 'fastify';

const create: EndPointFactory = ({
  endPointConfig,
  controller
}: IHandlerFactory): IbaseHandler => ({
  path: '/catalogs',
  method: 'post',
  async handler(req: FastifyRequest, res: FastifyReply) {
    try {
      if (!controller?.create) {
        throw new Error('Controller method "create" is not available');
      }
      const { result, error } = await controller.create(
        new CatalogCreateRequestEvent({
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
