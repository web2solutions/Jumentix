import { buildErrorResponsePayload, toHttpStatus } from '@src/shared/utils';

import type { BaseError, EErrorStringCodes } from '@src/infra/exceptions';
import type { TotalJsResponse } from '@src/interface/HTTP/adapters/total-js/TotalJsServer';

function sendErrorResponse(error: BaseError, res: TotalJsResponse) {
  return res
    .status(toHttpStatus(error.code as EErrorStringCodes) || 500)
    .json(buildErrorResponsePayload(error));
}

export default sendErrorResponse;
