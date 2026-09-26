import sendErrorResponse from '@src/interface/HTTP/adapters/fastify/responses/sendErrorResponse';

import { CatalogDeleteRequestEvent } from '@service-management-api/modules/Catalogs';

import type { EndPointFactory, IbaseHandler, IHandlerFactory } from '@src/interface/HTTP/ports';
import type { FastifyReply, FastifyRequest } from 'fastify';

const deleteOne: EndPointFactory = ({
  endPointConfig,
  controller
}: IHandlerFactory): IbaseHandler => ({
  path: '/catalogs/{id}',
  method: 'delete',
  async handler(req: FastifyRequest, res: FastifyReply) {
    try {
      const params = JSON.parse(JSON.stringify(req.params));
      const queryString = (req.query as Record<string, any>) || {};
      if (!controller?.delete) {
        throw new Error('Controller method "delete" is not available');
      }
      const { result, error } = await controller.delete(
        new CatalogDeleteRequestEvent({
          authorization: req.headers.authorization ?? '',
          schemaOAS: endPointConfig,
          params,
          queryString
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

export default deleteOne;
