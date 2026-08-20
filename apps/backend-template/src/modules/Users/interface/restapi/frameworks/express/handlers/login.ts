import { Request, Response } from 'express';
import { sendErrorResponse } from '@src/interface/HTTP/adapters/express/responses/sendErrorResponse';

import type {
  IHandlerFactory,
  IbaseHandler,
  EndPointFactory
} from '@src/interface/HTTP/ports';

import type { ILoginRequest } from '@src/modules/Users';
import { LoginRequestEvent } from '@src/modules/Users';

const login: EndPointFactory = (
  {
    endPointConfig,
    controller
  }: IHandlerFactory
): IbaseHandler => {
  return {
    path: '/auth/login',
    method: 'post',
    async handler(req: Request, res: Response) {
      try {
        const { result, error } = await controller!.login!(new LoginRequestEvent<ILoginRequest>({
          input: req.body as ILoginRequest,
          schemaOAS: endPointConfig
        }));
        if (error) throw error;
        return res.status(200).json(result);
      } catch (error: any) {
        return sendErrorResponse(error, res);
      }
    }
  };
};

export default login;
