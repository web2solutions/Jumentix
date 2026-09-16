import {
  EmailValueObject,
  DocumentValueObject,
  PhoneValueObject
} from '@src/modules/ddd/valueObjects';

export interface IUser {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | string | null;
  firstName: string;
  lastName: string;
  avatar: string;
  username: string;
  password: string;
  organization?: string;
  emails: EmailValueObject[];
  documents?: DocumentValueObject[];
  phones?: PhoneValueObject[];
  roles: string[];
}
