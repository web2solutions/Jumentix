import sendErrorResponse from '@src/interface/HTTP/adapters/express/responses/sendErrorResponse';

import type { Request, Response } from 'express';

import type { EndPointFactory, IbaseHandler, IHandlerFactory } from '@src/interface/HTTP/ports';

const apiDocGetHandlerFactory: EndPointFactory = ({
  spec,
  version
}: IHandlerFactory): IbaseHandler => ({
  path: `/${version}`,
  method: 'get',
  handler(req: Request, res: Response) {
    try {
      res.json(spec);
    } catch (error: any) {
      sendErrorResponse(error, res);
    }
  }
});

export default apiDocGetHandlerFactory;
