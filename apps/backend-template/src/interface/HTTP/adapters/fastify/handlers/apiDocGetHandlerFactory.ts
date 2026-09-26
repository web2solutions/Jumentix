import sendErrorResponse from '@src/interface/HTTP/adapters/fastify/responses/sendErrorResponse';

import type { FastifyReply, FastifyRequest } from 'fastify';

import type { BaseError } from '@src/infra/exceptions';
import type { EndPointFactory, IbaseHandler, IHandlerFactory } from '@src/interface/HTTP/ports';

const apiDocGetHandlerFactory: EndPointFactory = ({
  spec,
  version
}: IHandlerFactory): IbaseHandler => ({
  path: `/${version}`,
  method: 'get',
  async handler(_req: FastifyRequest, res: FastifyReply) {
    try {
      return await res.send(spec);
    } catch (error: unknown) {
      return sendErrorResponse(error as BaseError, res);
    }
  }
});

export default apiDocGetHandlerFactory;
