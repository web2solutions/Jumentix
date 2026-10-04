// file deepcode ignore ServerLeak: <error information is available only for authorized users>

import { buildErrorResponsePayload, toHttpStatus } from '@src/shared/utils';

import type { FastifyReply } from 'fastify';

import type { BaseError, EErrorStringCodes } from '@src/infra/exceptions';

function sendErrorResponse(error: BaseError, res: FastifyReply) {
  res
    .code(toHttpStatus(error.code as EErrorStringCodes) || 500)
    .send(buildErrorResponsePayload(error));
}

export default sendErrorResponse;
