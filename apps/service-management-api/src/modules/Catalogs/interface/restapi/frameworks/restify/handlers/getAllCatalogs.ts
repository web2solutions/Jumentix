import { Request, Response } from 'restify';
import { sendErrorResponse } from '@src/interface/HTTP/adapters/restify/responses/sendErrorResponse';

import type {
  IHandlerFactory,
  IbaseHandler,
  EndPointFactory
} from '@src/interface/HTTP/ports';

import { CatalogGetAllRequestEvent } from '@service-management-api/modules/Catalogs';

const getAll: EndPointFactory = (
  {
    endPointConfig,
    controller
  }: IHandlerFactory
): IbaseHandler => {
  return {
    path: '/catalogs',
    method: 'get',

    async handler(req: Request, res: Response) {
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
        res.status(200);
        return res.json({
          result, error, page, size, total
        });
      } catch (error: any) {
        return sendErrorResponse(error, res);
      }
    }
  };
};

export default getAll;
