import sendErrorResponse from '@src/interface/HTTP/adapters/express/responses/sendErrorResponse';

import CatalogGetOneRequestEvent from '@service-management-api/modules/Catalogs/events/CatalogGetOneRequestEvent';

import type { EndPointFactory, IbaseHandler, IHandlerFactory } from '@src/interface/HTTP/ports';
import type { Request, Response } from 'express';

const getOneById: EndPointFactory = ({
  endPointConfig,
  controller
}: IHandlerFactory): IbaseHandler => ({
  path: '/catalogs/{id}',
  method: 'get',

  async handler(req: Request, res: Response) {
    try {
      const params = req.params as Record<string, any>;
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
      return res.status(200).json(result);
    } catch (error: any) {
      return sendErrorResponse(error, res);
    }
  }
});

export default getOneById;
