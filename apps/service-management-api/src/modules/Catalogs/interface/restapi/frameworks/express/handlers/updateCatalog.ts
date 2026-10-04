import sendErrorResponse from '@src/interface/HTTP/adapters/express/responses/sendErrorResponse';

import CatalogUpdateRequestEvent from '@service-management-api/modules/Catalogs/events/CatalogUpdateRequestEvent';

import type { EndPointFactory, IbaseHandler, IHandlerFactory } from '@src/interface/HTTP/ports';
import type { Request, Response } from 'express';

const update: EndPointFactory = ({
  endPointConfig,
  controller
}: IHandlerFactory): IbaseHandler => ({
  path: '/catalogs/{id}',
  method: 'put',
  async handler(req: Request, res: Response) {
    try {
      const params = req.params as Record<string, any>;
      if (!controller?.update) {
        throw new Error('Controller method "update" is not available');
      }
      const { result, error } = await controller.update(
        new CatalogUpdateRequestEvent({
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

export default update;
