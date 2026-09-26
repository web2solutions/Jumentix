import { buildErrorResponsePayload, toHttpStatus } from '@src/shared/utils';

import type { BaseError, EErrorStringCodes } from '@src/infra/exceptions';
import type { AdonisJsResponse } from '@src/interface/HTTP/adapters/adonis-js/AdonisJsServer';

function sendErrorResponse(error: BaseError, res: AdonisJsResponse) {
  return res
    .status(toHttpStatus(error.code as EErrorStringCodes) || 500)
    .json(buildErrorResponsePayload(error));
}

export default sendErrorResponse;
