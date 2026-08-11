import { Request, Response } from 'express';
import { sendErrorResponse } from '@src/interface/HTTP/adapters/express/responses/sendErrorResponse';

import type {
  IHandlerFactory,
  IbaseHandler,
  EndPointFactory
} from '@src/interface/HTTP/ports';

import { CatalogDeleteRequestEvent } from '@src/modules/Catalogs/events/CatalogDeleteRequestEvent';

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
        return res.status(200).json(result);
      } catch (error: any) {
        return sendErrorResponse(error, res);
      }
    }
  };
};

export default deleteOne;
