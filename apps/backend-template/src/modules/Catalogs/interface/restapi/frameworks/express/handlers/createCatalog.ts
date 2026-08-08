import { Request, Response } from 'express';
import { sendErrorResponse } from '@src/interface/HTTP/adapters/express/responses/sendErrorResponse';

import type {
  IHandlerFactory
} from '@src/interface/HTTP/ports';
import type {
  IbaseHandler,
  EndPointFactory
} from '@src/interface/HTTP/ports';

import { CatalogCreateRequestEvent } from '@src/modules/Catalogs/events/CatalogCreateRequestEvent';

const create: EndPointFactory = (
  {
    endPointConfig,
    controller
  }: IHandlerFactory
): IbaseHandler => {
  return {
    path: '/catalogs',
    method: 'post',
    async handler(req: Request, res: Response) {
      try {
        const { result, error } = await controller!.create!(new CatalogCreateRequestEvent({
          authorization: req.headers.authorization ?? '',
          input: req.body,
          schemaOAS: endPointConfig
        }));
        if (error) throw error;
        return res.status(201).json(result);
      } catch (error: any) {
        return sendErrorResponse(error, res);
      }
    }
  };
};

export default create;
