import sendErrorResponse from '@src/interface/HTTP/adapters/restify/responses/sendErrorResponse';
import { UserPhoneCreateRequestEvent } from '@src/modules/Users';

import type { Request, Response } from 'restify';

import type { EndPointFactory, IbaseHandler, IHandlerFactory } from '@src/interface/HTTP/ports';
import type { RequestCreatePhone, UserController } from '@src/modules/Users';

const createPhone: EndPointFactory = ({
  endPointConfig,
  controller
}: IHandlerFactory): IbaseHandler => ({
  path: '/users/{id}/createPhone',
  method: 'post',
  async handler(req: Request, res: Response) {
    try {
      const params = req.params as Record<string, any>;
      if (!controller) {
        throw new Error('The createPhone endpoint requires a controller.');
      }
      const { result, error } = await (controller as UserController).createPhone(
        new UserPhoneCreateRequestEvent({
          authorization: req.headers.authorization ?? '',
          params,
          input: req.body as RequestCreatePhone,
          schemaOAS: endPointConfig
        })
      );
      if (error) throw error;
      res.status(201);
      return res.json(result);
    } catch (error: any) {
      return sendErrorResponse(error, res);
    }
  }
});

export default createPhone;
