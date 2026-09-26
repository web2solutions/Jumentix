import { Context } from '@src/infra/context/Context';
import sendErrorResponse from '@src/interface/HTTP/adapters/express/responses/sendErrorResponse';

import type { Request, Response } from 'express';

import type { BaseError } from '@src/infra/exceptions';
import type { EndPointFactory, IbaseHandler } from '@src/interface/HTTP/ports';

const localhostGetHandlerFactory: EndPointFactory = (): IbaseHandler => ({
  path: '/',
  method: 'get',
  handler(req: Request, res: Response) {
    try {
      const store: Map<any, any> = Context.getStore() as Map<any, any>;
      res.json({ status: 'result', correlationId: store.get('correlationId') });
    } catch (error: any) {
      sendErrorResponse(error as BaseError, res);
    }
  }
});

export default localhostGetHandlerFactory;
