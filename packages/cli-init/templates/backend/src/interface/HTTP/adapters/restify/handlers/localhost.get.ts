import { Context } from '@src/infra/context/Context';

import type { Request, Response } from 'restify';

import type { EndPointFactory, IbaseHandler } from '@src/interface/HTTP/ports';

const localhostGetHandlerFactory: EndPointFactory = (): IbaseHandler => ({
  path: '/',
  method: 'get',
  async handler(req: Request, res: Response) {
    const store: Map<any, any> = Context.getStore() as Map<any, any>;
    return res.json({ status: 'result', correlationId: store.get('correlationId') });
  }
});

export default localhostGetHandlerFactory;
