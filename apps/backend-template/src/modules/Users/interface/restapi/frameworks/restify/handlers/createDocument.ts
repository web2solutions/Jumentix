import sendErrorResponse from '@src/interface/HTTP/adapters/restify/responses/sendErrorResponse';
import { UserDocumentCreateRequestEvent } from '@src/modules/Users';

import type { Request, Response } from 'restify';

import type { EndPointFactory, IbaseHandler, IHandlerFactory } from '@src/interface/HTTP/ports';
import type { RequestCreateDocument, UserController } from '@src/modules/Users';

const createDocument: EndPointFactory = ({
  endPointConfig,
  controller
}: IHandlerFactory): IbaseHandler => ({
  path: '/users/{id}/createDocument',
  method: 'post',
  async handler(req: Request, res: Response) {
    try {
      const params = req.params as Record<string, any>;
      if (!controller) {
        throw new Error('The createDocument endpoint requires a controller.');
      }
      const { result, error } = await (controller as UserController).createDocument(
        new UserDocumentCreateRequestEvent({
          authorization: req.headers.authorization ?? '',
          params,
          input: req.body as RequestCreateDocument,
          schemaOAS: endPointConfig
        })
      );
      if (error) throw error;
      res.status(201);
      return res.json(result);
    } catch (error: any) {
      return sendErrorResponse(error, res);
    }
  }
});

export default createDocument;
