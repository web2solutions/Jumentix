import sendErrorResponse from '@src/interface/HTTP/adapters/fastify/responses/sendErrorResponse';

import { CatalogGetOneRequestEvent } from '@service-management-api/modules/Catalogs';

import type { EndPointFactory, IbaseHandler, IHandlerFactory } from '@src/interface/HTTP/ports';
import type { FastifyReply, FastifyRequest } from 'fastify';

const getOneById: EndPointFactory = ({
  endPointConfig,
  controller
}: IHandlerFactory): IbaseHandler => ({
  path: '/catalogs/{id}',
  method: 'get',

  async handler(req: FastifyRequest, res: FastifyReply) {
    try {
      const params = JSON.parse(JSON.stringify(req.params));
      if (!controller?.getOneById) {
        throw new Error('Controller method "getOneById" is not available');
      }
      const { result, error } = await controller.getOneById(
        new CatalogGetOneRequestEvent({
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
