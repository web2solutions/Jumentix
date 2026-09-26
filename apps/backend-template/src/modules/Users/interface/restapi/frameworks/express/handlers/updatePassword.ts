import sendErrorResponse from '@src/interface/HTTP/adapters/express/responses/sendErrorResponse';
import { UserPasswordUpdateRequestEvent } from '@src/modules/Users';

import type { Request, Response } from 'express';

import type { EndPointFactory, IbaseHandler, IHandlerFactory } from '@src/interface/HTTP/ports';
import type { RequestUpdatePassword, UserController } from '@src/modules/Users';

const updatePassword: EndPointFactory = ({
  endPointConfig,
  controller
}: IHandlerFactory): IbaseHandler => ({
  path: '/users/{id}/updatePassword',
  method: 'put',

  async handler(req: Request, res: Response) {
    try {
      const params = req.params as Record<string, any>;
      if (!controller) {
        throw new Error('The updatePassword endpoint requires a controller.');
      }
      const { result, error } = await (controller as UserController).updatePassword(
        new UserPasswordUpdateRequestEvent({
          authorization: req.headers.authorization ?? '',
          params,
          input: req.body as RequestUpdatePassword,
          schemaOAS: endPointConfig
        })
      );
      if (error) throw error;
      return res.status(200).json(result);
    } catch (error: any) {
      return sendErrorResponse(error, res);
    }
  }
});

export default updatePassword;
