import type { EmailValueObject } from '@src/modules/ddd/valueObjects';
import type { RequestCreateUser } from '@src/modules/Users/interface/dto/RequestCreateUser';

export interface IRegisterRequest extends RequestCreateUser {
  firstName: string;
  username: string;
  password: string;
  emails: EmailValueObject[];
}
