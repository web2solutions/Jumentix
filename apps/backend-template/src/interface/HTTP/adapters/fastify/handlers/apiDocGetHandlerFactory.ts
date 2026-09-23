import { FastifyRequest, FastifyReply } from 'fastify';

import type { IHandlerFactory, EndPointFactory, IbaseHandler } from '@src/interface/HTTP/ports';
import { sendErrorResponse } from '@src/interface/HTTP/adapters/fastify/responses/sendErrorResponse';
import { BaseError } from '@src/infra/exceptions';

const apiDocGetHandlerFactory: EndPointFactory = (
  { spec, version }: IHandlerFactory
): IbaseHandler => {
  return {
    path: `/${version}`,
    method: 'get',
    async handler(_req: FastifyRequest, res: FastifyReply) {
      try {
        return await res.send(spec);
      } catch (error: unknown) {
        return sendErrorResponse(error as BaseError, res);
      }
    }
  };
};

export default apiDocGetHandlerFactory;
