import { Request, Response } from 'restify';
import { sendErrorResponse } from '@src/interface/HTTP/adapters/restify/responses/sendErrorResponse';

import type {
  IHandlerFactory,
  IbaseHandler,
  EndPointFactory
} from '@src/interface/HTTP/ports';

import { CatalogGetOneRequestEvent } from '@service-management-api/modules/Catalogs';

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
        res.status(200);
        return res.json(result);
      } catch (error: any) {
        return sendErrorResponse(error, res);
      }
    }
  };
};

export default getOneById;
