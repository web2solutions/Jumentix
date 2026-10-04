import sendErrorResponse from '@src/interface/HTTP/adapters/restify/responses/sendErrorResponse';

import type { Request, Response } from 'restify';

import type { EndPointFactory, IbaseHandler, IHandlerFactory } from '@src/interface/HTTP/ports';

const apiDocGetHandlerFactory: EndPointFactory = ({
  spec,
  version
}: IHandlerFactory): IbaseHandler => ({
  path: `/${version}`,
  method: 'get',
  async handler(req: Request, res: Response): Promise<any> {
    try {
      return res.json(spec);
    } catch (error: any) {
      return sendErrorResponse(error, res);
    }
  }
});

export default apiDocGetHandlerFactory;
