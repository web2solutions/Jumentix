import { UNAUTHORIZED_ERROR_NAME } from '@src/config/constants';
import BaseError from '@src/infra/exceptions/BaseError';
import { EErrorStringCodes } from '@src/infra/exceptions/error.codes';

class UnauthorizedError extends BaseError {
  readonly code = EErrorStringCodes.UNAUTHORIZED;

  readonly name = UNAUTHORIZED_ERROR_NAME;
}

export default UnauthorizedError;
