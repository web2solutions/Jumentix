import { EVENT_INVALID_MESSAGE } from '@src/config/constants';
import BaseError from '@src/infra/exceptions/BaseError';
import { EErrorStringCodes } from '@src/infra/exceptions/error.codes';

class ComposeEventError extends BaseError {
  readonly code = EErrorStringCodes.INVALID_INPUT;

  readonly name = EVENT_INVALID_MESSAGE;
}

export default ComposeEventError;
