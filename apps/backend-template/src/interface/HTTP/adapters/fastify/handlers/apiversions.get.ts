import { DOCS_PREFIX } from '@src/config/constants';

import type { FastifyReply, FastifyRequest } from 'fastify';

import type { EndPointFactory, IbaseHandler, IHandlerFactory } from '@src/interface/HTTP/ports';

const apiVersionsGetHandlerFactory: EndPointFactory = ({
  apiDocs
}: IHandlerFactory): IbaseHandler => ({
  path: '/versions',
  method: 'get',
  async handler(req: FastifyRequest, res: FastifyReply): Promise<any> {
    const versions: Record<string, string> = {};
    if (typeof apiDocs !== 'undefined') {
      for (const [version] of apiDocs) {
        versions[version] = `${DOCS_PREFIX}/${version}`;
      }
    }
    res.code(200);
    return Promise.resolve({ versions });
  }
});

export default apiVersionsGetHandlerFactory;
