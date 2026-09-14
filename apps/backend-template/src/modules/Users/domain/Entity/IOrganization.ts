import {
  AddressValueObject,
  EmailValueObject,
  PhoneValueObject
} from '@src/modules/ddd/valueObjects';

export interface IOrganization {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | string | null;
  name: string;
  address: AddressValueObject[];
  phone: PhoneValueObject[];
  email: EmailValueObject[];
  users: string[];
}
