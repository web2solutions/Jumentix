import { DOCS_PREFIX } from '@src/config/constants';

import type { Request, Response } from 'restify';

import type { EndPointFactory, IbaseHandler, IHandlerFactory } from '@src/interface/HTTP/ports';

const apiVersionsGetHandlerFactory: EndPointFactory = ({
  apiDocs
}: IHandlerFactory): IbaseHandler => ({
  path: '/versions',
  method: 'get',
  async handler(req: Request, res: Response): Promise<any> {
    const versions: Record<string, string> = {};
    if (typeof apiDocs !== 'undefined') {
      for (const [version] of apiDocs) {
        versions[version] = `${DOCS_PREFIX}/${version}`;
      }
    }
    res.status(200);
    return res.json({ versions });
  }
});

export default apiVersionsGetHandlerFactory;
