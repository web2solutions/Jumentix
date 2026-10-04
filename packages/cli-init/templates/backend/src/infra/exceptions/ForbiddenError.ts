import { FORBIDDEN_ERROR_NAME } from '@src/config/constants';
import BaseError from '@src/infra/exceptions/BaseError';
import { EErrorStringCodes } from '@src/infra/exceptions/error.codes';

class ForbiddenError extends BaseError {
  readonly code = EErrorStringCodes.FORBIDDEN;

  readonly name = FORBIDDEN_ERROR_NAME;
}

export default ForbiddenError;
