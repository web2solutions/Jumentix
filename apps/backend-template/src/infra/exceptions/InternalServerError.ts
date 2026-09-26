import { INTERNAL_SERVER_ERROR } from '@src/config/constants';
import BaseError from '@src/infra/exceptions/BaseError';
import { EErrorStringCodes } from '@src/infra/exceptions/error.codes';

class InternalServerError extends BaseError {
  readonly code = EErrorStringCodes.INTERNAL_SERVER_ERROR;

  readonly name = INTERNAL_SERVER_ERROR;
}

export default InternalServerError;
