import { Request, Response } from 'express';
import { sendErrorResponse } from '@src/interface/HTTP/adapters/express/responses/sendErrorResponse';

import type {
  IHandlerFactory,
  IbaseHandler,
  EndPointFactory
} from '@src/interface/HTTP/ports';

import { CatalogUpdateRequestEvent } from '@service-management-api/modules/Catalogs/events/CatalogUpdateRequestEvent';

const update: EndPointFactory = (
  {
    endPointConfig,
    controller
  }: IHandlerFactory
): IbaseHandler => {
  return {
    path: '/catalogs/{id}',
    method: 'put',
    async handler(req: Request, res: Response) {
      try {
        const params = req.params as Record<string, any>;
        const { result, error } = await controller!.update!(new CatalogUpdateRequestEvent({
          authorization: req.headers.authorization ?? '',
          input: req.body,
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

export default update;
