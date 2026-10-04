import sendErrorResponse from '@src/interface/HTTP/adapters/express/responses/sendErrorResponse';
import UserGetOneRequestEvent from '@src/modules/Users/events/UserGetOneRequestEvent';

import type { Request, Response } from 'express';

import type { EndPointFactory, IbaseHandler, IHandlerFactory } from '@src/interface/HTTP/ports';

const getOneById: EndPointFactory = ({
  endPointConfig,
  controller
}: IHandlerFactory): IbaseHandler => ({
  path: '/users/{id}',
  method: 'get',

  async handler(req: Request, res: Response) {
    try {
      const params = req.params as Record<string, any>;
      if (!controller?.getOneById) {
        throw new Error('The getOneById endpoint requires a controller implementing getOneById.');
      }
      const { result, error } = await controller.getOneById(
        new UserGetOneRequestEvent({
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
