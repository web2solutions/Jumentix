import { Request, Response } from 'restify';
import { sendErrorResponse } from '@src/interface/HTTP/adapters/restify/responses/sendErrorResponse';

import type {
  IHandlerFactory,
  IbaseHandler,
  EndPointFactory
} from '@src/interface/HTTP/ports';

import { CatalogDeleteRequestEvent } from '@src/modules/Catalogs';

const deleteOne: EndPointFactory = (
  {
    endPointConfig,
    controller
  }: IHandlerFactory
): IbaseHandler => {
  return {
    path: '/catalogs/{id}',
    method: 'delete',
    async handler(req: Request, res: Response) {
      try {
        const params = req.params as Record<string, any>;
        const queryString = req.query as Record<string, any> || {};
        const { result, error } = await controller!.delete!(new CatalogDeleteRequestEvent({
          authorization: req.headers.authorization ?? '',
          schemaOAS: endPointConfig,
          params,
          queryString
        }));
        if (error) throw error;
        res.status(200);
        return res.json(result);
      } catch (error: any) {
        return sendErrorResponse(error, res);
      }
    }
  };
};

export default deleteOne;
