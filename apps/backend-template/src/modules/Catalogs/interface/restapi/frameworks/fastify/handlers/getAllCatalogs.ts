import { FastifyRequest, FastifyReply } from 'fastify';
import { sendErrorResponse } from '@src/interface/HTTP/adapters/fastify/responses/sendErrorResponse';

import type {
  IHandlerFactory,
  IbaseHandler,
  EndPointFactory
} from '@src/interface/HTTP/ports';

import { CatalogGetAllRequestEvent } from '@src/modules/Catalogs';

const getAll: EndPointFactory = (
  {
    endPointConfig,
    controller
  }: IHandlerFactory
): IbaseHandler => {
  return {
    path: '/catalogs',
    method: 'get',

    async handler(req: FastifyRequest, res: FastifyReply) {
      try {
        const queryString = req.query as Record<string, any> || {};
        if (!queryString.page) queryString.page = '1';
        const {
          result, error, page, size, total
        } = await controller!.getAll!(new CatalogGetAllRequestEvent({
          authorization: req.headers.authorization ?? '',
          schemaOAS: endPointConfig,
          queryString
        }));
        if (error) throw error;
        res.code(200);
        return {
          result, error, page, size, total
        };
      } catch (error: any) {
        return sendErrorResponse(error, res);
      }
    }
  };
};

export default getAll;
