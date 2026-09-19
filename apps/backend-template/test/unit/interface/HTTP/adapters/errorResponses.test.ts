/* eslint-disable @typescript-eslint/no-explicit-any, jest/max-expects */
import { sendErrorResponse as sendDerbyErrorResponse } from '@src/interface/HTTP/adapters/derby-js/responses/sendErrorResponse';
import { sendErrorResponse as sendFastifyErrorResponse } from '@src/interface/HTTP/adapters/fastify/responses/sendErrorResponse';
import { sendErrorResponse as sendRestifyErrorResponse } from '@src/interface/HTTP/adapters/restify/responses/sendErrorResponse';
import { ForbiddenError } from '@src/infra/exceptions';

describe('http adapter error responses', () => {
  it('falls back to HTTP 500 when an error code has no mapping', () => {
    expect.hasAssertions();
    const error = new ForbiddenError('unknown mapped code') as any;
    error.code = 'GENERIC.UNKNOWN';
    const fastifyReply = {
      code: jest.fn().mockReturnThis(),
      send: jest.fn()
    };
    const restifyResponse = {
      status: jest.fn(),
      json: jest.fn()
    };
    const derbyResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    sendFastifyErrorResponse(error, fastifyReply as never);
    sendRestifyErrorResponse(error, restifyResponse as never);
    sendDerbyErrorResponse(error, derbyResponse as never);

    expect(fastifyReply.code).toHaveBeenCalledWith(500);
    expect(fastifyReply.send).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Forbidden - unknown mapped code'
    }));
    expect(restifyResponse.status).toHaveBeenCalledWith(500);
    expect(restifyResponse.json).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Forbidden - unknown mapped code'
    }));
    expect(derbyResponse.status).toHaveBeenCalledWith(500);
    expect(derbyResponse.json).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Forbidden - unknown mapped code'
    }));
  });
});
