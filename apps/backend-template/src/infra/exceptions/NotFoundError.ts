import { NOT_FOUND_ERROR_NAME } from '@src/config/constants';
import BaseError from '@src/infra/exceptions/BaseError';
import { EErrorStringCodes } from '@src/infra/exceptions/error.codes';

class NotFoundError extends BaseError {
  readonly code = EErrorStringCodes.NOT_FOUND;

  readonly name = NOT_FOUND_ERROR_NAME;
}

export default NotFoundError;
