import { buildErrorResponsePayload, toHttpStatus } from '@src/shared/utils';

import type { Response } from 'express';

import type { BaseError, EErrorStringCodes } from '@src/infra/exceptions';

function sendErrorResponse(error: BaseError, res: Response) {
  res
    .status(toHttpStatus(error.code as EErrorStringCodes) || 500)
    .json(buildErrorResponsePayload(error));
}

export default sendErrorResponse;
