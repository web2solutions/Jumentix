import { buildErrorResponsePayload, toHttpStatus } from '@src/shared/utils';

import type { BaseError, EErrorStringCodes } from '@src/infra/exceptions';
import type { VercelFunctionsResponse } from '@src/interface/HTTP/adapters/vercel-functions/vercel-functions';

function sendErrorResponse(error: BaseError, res: VercelFunctionsResponse) {
  return res
    .status(toHttpStatus(error.code as EErrorStringCodes) || 500)
    .json(buildErrorResponsePayload(error));
}

export default sendErrorResponse;
