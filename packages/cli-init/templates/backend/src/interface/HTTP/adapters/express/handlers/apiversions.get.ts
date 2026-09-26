import { DOCS_PREFIX } from '@src/config/constants';

import type { Request, Response } from 'express';

import type { EndPointFactory, IbaseHandler, IHandlerFactory } from '@src/interface/HTTP/ports';

const apiVersionsGetHandlerFactory: EndPointFactory = ({
  apiDocs
}: IHandlerFactory): IbaseHandler => ({
  path: '/versions',
  method: 'get',
  handler(req: Request, res: Response): void {
    const versions: Record<string, string> = {};
    if (typeof apiDocs !== 'undefined') {
      for (const [version] of apiDocs) {
        versions[version] = `${DOCS_PREFIX}/${version}`;
      }
    }
    res.status(200).json({ versions });
  }
});

export default apiVersionsGetHandlerFactory;
