import { Context } from '@src/infra/context/Context';

import type { EndPointFactory, IbaseHandler } from '@src/interface/HTTP/ports';

const localhostGetHandlerFactory: EndPointFactory = (): IbaseHandler => ({
  path: '/',
  method: 'get',
  async handler(): Promise<any> {
    const store: Map<any, any> = Context.getStore() as Map<any, any>;
    return { status: 'result', correlationId: store.get('correlationId') };
  }
});

export default localhostGetHandlerFactory;
