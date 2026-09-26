import sendErrorResponse from '@src/interface/HTTP/adapters/fastify/responses/sendErrorResponse';
import { UserDocumentDeleteRequestEvent } from '@src/modules/Users';

import type { FastifyReply, FastifyRequest } from 'fastify';

import type { EndPointFactory, IbaseHandler, IHandlerFactory } from '@src/interface/HTTP/ports';
import type { UserController } from '@src/modules/Users';

const deleteDocument: EndPointFactory = ({
  endPointConfig,
  controller
}: IHandlerFactory): IbaseHandler => ({
  path: '/users/{id}/deleteDocument/{documentId}',
  method: 'delete',

  async handler(req: FastifyRequest, res: FastifyReply) {
    try {
      const params = JSON.parse(JSON.stringify(req.params));
      if (!controller) {
        throw new Error('The deleteDocument endpoint requires a controller.');
      }
      const { result, error } = await (controller as UserController).deleteDocument(
        new UserDocumentDeleteRequestEvent({
          authorization: req.headers.authorization ?? '',
          params,
          schemaOAS: endPointConfig
        })
      );
      if (error) throw error;
      res.code(200);
      return result;
    } catch (error: any) {
      return sendErrorResponse(error, res);
    }
  }
});

export default deleteDocument;
