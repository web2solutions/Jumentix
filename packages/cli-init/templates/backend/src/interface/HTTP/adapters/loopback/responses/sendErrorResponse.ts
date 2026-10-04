import { buildErrorResponsePayload, toHttpStatus } from '@src/shared/utils';

import type { BaseError, EErrorStringCodes } from '@src/infra/exceptions';
import type { LoopBackResponse } from '@src/interface/HTTP/adapters/loopback/LoopBackServer';

function sendErrorResponse(error: BaseError, res: LoopBackResponse) {
  return res
    .status(toHttpStatus(error.code as EErrorStringCodes) || 500)
    .json(buildErrorResponsePayload(error));
}

export default sendErrorResponse;
