import { Request, Response } from 'express';
import { sendErrorResponse } from '@src/interface/HTTP/adapters/express/responses/sendErrorResponse';

import type {
  IHandlerFactory,
  IbaseHandler,
  EndPointFactory
} from '@src/interface/HTTP/ports';

import { CatalogGetAllRequestEvent } from '@src/modules/Catalogs/events/CatalogGetAllRequestEvent';

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
        return res.status(200).json({
          result, error, page, size, total
        });
      } catch (error: any) {
        return sendErrorResponse(error, res);
      }
    }
  };
};

export default getAll;
