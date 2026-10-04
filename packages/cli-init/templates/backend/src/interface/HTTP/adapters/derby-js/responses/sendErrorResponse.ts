import { buildErrorResponsePayload, toHttpStatus } from '@src/shared/utils';

import type { BaseError, EErrorStringCodes } from '@src/infra/exceptions';
import type { DerbyJsResponse } from '@src/interface/HTTP/adapters/derby-js/DerbyJsServer';

function sendErrorResponse(error: BaseError, res: DerbyJsResponse) {
  return res
    .status(toHttpStatus(error.code as EErrorStringCodes) || 500)
    .json(buildErrorResponsePayload(error));
}

export default sendErrorResponse;
