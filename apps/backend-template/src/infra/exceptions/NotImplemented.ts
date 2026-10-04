import { INFRA_NOT_IMPLEMENTED } from '@src/config/constants';
import BaseError from '@src/infra/exceptions/BaseError';
import { EErrorStringCodes } from '@src/infra/exceptions/error.codes';

class NotImplemented extends BaseError {
  readonly code = EErrorStringCodes.NOT_IMPLEMENTED;

  readonly name = INFRA_NOT_IMPLEMENTED;
}

export default NotImplemented;
