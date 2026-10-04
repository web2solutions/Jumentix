import { VALIDATION_ERROR_NAME } from '@src/config/constants';
import BaseError from '@src/infra/exceptions/BaseError';
import { EErrorStringCodes } from '@src/infra/exceptions/error.codes';

class ValidationError extends BaseError {
  readonly code = EErrorStringCodes.INVALID_INPUT;

  readonly name = VALIDATION_ERROR_NAME;
}

export default ValidationError;
