import { buildErrorResponsePayload, toHttpStatus } from '@src/shared/utils';

import type { BaseError, EErrorStringCodes } from '@src/infra/exceptions';
import type { SailsJsResponse } from '@src/interface/HTTP/adapters/sails-js/SailsJsServer';

function sendErrorResponse(error: BaseError, res: SailsJsResponse) {
  return res
    .status(toHttpStatus(error.code as EErrorStringCodes) || 500)
    .json(buildErrorResponsePayload(error));
}

export default sendErrorResponse;
