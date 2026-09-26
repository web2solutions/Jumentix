import { LOCKED_RESOURCE_ERROR_NAME } from '@src/config/constants';
import BaseError from '@src/infra/exceptions/BaseError';
import { EErrorStringCodes } from '@src/infra/exceptions/error.codes';

class ResourceLockedError extends BaseError {
  readonly code = EErrorStringCodes.RESOURCE_LOCKED;

  readonly name = LOCKED_RESOURCE_ERROR_NAME;
}

export default ResourceLockedError;
