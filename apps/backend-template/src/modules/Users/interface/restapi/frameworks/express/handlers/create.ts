import sendErrorResponse from '@src/interface/HTTP/adapters/express/responses/sendErrorResponse';
import UserCreateRequestEvent from '@src/modules/Users/events/UserCreateRequestEvent';

import type { Request, Response } from 'express';

import type { EndPointFactory, IbaseHandler, IHandlerFactory } from '@src/interface/HTTP/ports';

const create: EndPointFactory = ({
  endPointConfig,
  controller
}: IHandlerFactory): IbaseHandler => ({
  path: '/users',
  method: 'post',
  async handler(req: Request, res: Response) {
    try {
      if (!controller?.create) {
        throw new Error('The create endpoint requires a controller implementing create.');
      }
      const { result, error } = await controller.create(
        new UserCreateRequestEvent({
          authorization: req.headers.authorization ?? '',
          input: req.body,
          schemaOAS: endPointConfig
        })
      );
      if (error) throw error;
      return res.status(201).json(result);
    } catch (error: any) {
      return sendErrorResponse(error, res);
    }
  }
});

export default create;
