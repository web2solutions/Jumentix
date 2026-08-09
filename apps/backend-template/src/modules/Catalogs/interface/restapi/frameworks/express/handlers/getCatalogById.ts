import { Request, Response } from 'express';
import { sendErrorResponse } from '@src/interface/HTTP/adapters/express/responses/sendErrorResponse';

import type {
  IHandlerFactory
} from '@src/interface/HTTP/ports';
import type {
  IbaseHandler,
  EndPointFactory
} from '@src/interface/HTTP/ports';

import { CatalogGetOneRequestEvent } from '@src/modules/Catalogs/events/CatalogGetOneRequestEvent';

const getOneById: EndPointFactory = (
  {
    endPointConfig,
    controller
  }: IHandlerFactory
): IbaseHandler => {
  return {
    path: '/catalogs/{id}',
    method: 'get',

    async handler(req: Request, res: Response) {
      try {
        const params = req.params as Record<string, any>;
        const { result, error } = await controller!.getOneById!(new CatalogGetOneRequestEvent({
          authorization: req.headers.authorization ?? '',
          schemaOAS: endPointConfig,
          params
        }));
        if (error) throw error;
        return res.status(200).json(result);
      } catch (error: any) {
        return sendErrorResponse(error, res);
      }
    }
  };
};

export default getOneById;
