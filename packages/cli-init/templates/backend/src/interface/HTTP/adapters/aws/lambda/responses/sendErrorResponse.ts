import { buildErrorResponsePayload, toHttpStatus } from '@src/shared/utils';

import type { BaseError, EErrorStringCodes } from '@src/infra/exceptions';

function sendErrorResponse(error: BaseError) {
  return {
    statusCode: toHttpStatus(error.code as EErrorStringCodes) || 500,
    body: JSON.stringify(buildErrorResponsePayload(error))
  };
}

export default sendErrorResponse;
