import sendErrorResponse from '@src/interface/HTTP/adapters/express/responses/sendErrorResponse';

import CatalogDeleteRequestEvent from '@service-management-api/modules/Catalogs/events/CatalogDeleteRequestEvent';

import type { EndPointFactory, IbaseHandler, IHandlerFactory } from '@src/interface/HTTP/ports';
import type { Request, Response } from 'express';

const deleteOne: EndPointFactory = ({
  endPointConfig,
  controller
}: IHandlerFactory): IbaseHandler => ({
  path: '/catalogs/{id}',
  method: 'delete',
  async handler(req: Request, res: Response) {
    try {
      const params = req.params as Record<string, any>;
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
      return res.status(200).json(result);
    } catch (error: any) {
      return sendErrorResponse(error, res);
    }
  }
});

export default deleteOne;
