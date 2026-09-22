import type { RequestCreateAddress } from '@src/modules/Users/interface/dto/RequestCreateAddress';
import type { RequestCreateEmail } from '@src/modules/Users/interface/dto/RequestCreateEmail';
import type { RequestCreatePhone } from '@src/modules/Users/interface/dto/RequestCreatePhone';

export interface RequestCreateOrganization {
  id?: string;
  name: string;
  address?: RequestCreateAddress[];
  phone?: RequestCreatePhone[];
  email?: RequestCreateEmail[];
  users?: string[];
}
