import {
  AddressValueObject,
  EAddressType,
  EEmailType,
  EmailValueObject,
  PhoneValueObject
} from '@src/modules/ddd/valueObjects';
import type { IOrganization } from '@src/modules/Users/domain/Entity/IOrganization';

const now = new Date();

const organizations: IOrganization[] = [
  {
    id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    createdAt: now,
    updatedAt: now,
    name: 'ACME',
    address: [{
      email: 'hq@acme.dev',
      type: EAddressType.work,
      isPrimary: true
    } as AddressValueObject],
    email: [{
      email: 'contact@acme.dev',
      type: EEmailType.work,
      isPrimary: true
    } as EmailValueObject],
    phone: [{
      number: '99805-4033',
      localCode: '27',
      countryCode: '+55',
      isPrimary: true
    } as PhoneValueObject],
    users: []
  },
  {
    id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
    createdAt: now,
    updatedAt: now,
    name: 'Umbrella',
    address: [{
      email: 'ops@umbrella.dev',
      type: EAddressType.work,
      isPrimary: true
    } as AddressValueObject],
    email: [{
      email: 'support@umbrella.dev',
      type: EEmailType.work,
      isPrimary: true
    } as EmailValueObject],
    phone: [{
      number: '98883-2732',
      localCode: '27',
      countryCode: '+55',
      isPrimary: true
    } as PhoneValueObject],
    users: []
  },
  {
    // XpertMinds is the primary tenant: eduardo (superadmin), admin and user
    // seeds all belong to it (JUM-772).
    id: 'b1ffc4d2-1a2b-4c3d-9e8f-7a6b5c4d3f00',
    createdAt: now,
    updatedAt: now,
    name: 'XpertMinds',
    address: [{
      email: 'hq@xpertminds.dev',
      type: EAddressType.work,
      isPrimary: true
    } as AddressValueObject],
    email: [{
      email: 'contact@xpertminds.dev',
      type: EEmailType.work,
      isPrimary: true
    } as EmailValueObject],
    phone: [{
      number: '99805-4033',
      localCode: '27',
      countryCode: '+55',
      isPrimary: true
    } as PhoneValueObject],
    users: []
  }
];

export default organizations;
