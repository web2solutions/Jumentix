import sendErrorResponse from '@src/interface/HTTP/adapters/express/responses/sendErrorResponse';

import CatalogRestoreRequestEvent from '@service-management-api/modules/Catalogs/events/CatalogRestoreRequestEvent';

import type { EndPointFactory, IbaseHandler, IHandlerFactory } from '@src/interface/HTTP/ports';
import type { Request, Response } from 'express';

const restore: EndPointFactory = ({
  endPointConfig,
  controller
}: IHandlerFactory): IbaseHandler => ({
  path: '/catalogs/{id}/restore',
  method: 'post',
  async handler(req: Request, res: Response) {
    try {
      const params = req.params as Record<string, any>;
      if (!controller?.restore) {
        throw new Error('Controller method "restore" is not available');
      }
      const { result, error } = await controller.restore(
        new CatalogRestoreRequestEvent({
          authorization: req.headers.authorization ?? '',
          input: req.body,
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

export default restore;
