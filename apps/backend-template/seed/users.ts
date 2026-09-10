// file deepcode ignore NoHardcodedPasswords: <mocked passwords>
import type { IUser } from '@src/modules/Users';
import {
  DocumentValueObject,
  EDocumentType,
  EEmailType,
  EmailValueObject,
  PhoneValueObject
} from '@src/modules/ddd/valueObjects';
import organizations from '@seed/organizations';

const buildSeedCredential = (account: string): string => `seed-${account}-A1!`;
const now = new Date();

const users: Array<IUser> = [{
  id: 'b1ffc4d2-1a2b-4c3d-9e8f-7a6b5c4d3e01',
  createdAt: now,
  updatedAt: now,
  firstName: 'eduardo',
  lastName: 'Almeida',
  emails: [
    {
      email: 'eduardo@xpertminds.dev',
      type: EEmailType.work,
      isPrimary: true
    } as EmailValueObject,
    {
      email: 'web2solucoes@gmail.com',
      type: EEmailType.work,
      isPrimary: false
    } as EmailValueObject,
    {
      email: 'perottas1@hotmail.com',
      type: EEmailType.work,
      isPrimary: false
    } as EmailValueObject
  ],
  avatar: 'avatar.png',
  username: 'eduardo@xpertminds.dev',
  password: 'eduardo@123456',
  organization: organizations[0].id,
  roles: ['superadmin'],
  documents: [
    {
      data: '000-000-000',
      type: EDocumentType.SSN,
      countryIssue: 'US'
    } as DocumentValueObject,
    {
      data: '000.000.000-00',
      type: EDocumentType.CPF,
      countryIssue: 'BR'
    } as DocumentValueObject,
    {
      data: '0000000000000',
      type: EDocumentType.PASSPORT,
      countryIssue: 'BR'
    } as DocumentValueObject
  ],
  phones: [
    {
      number: '99805-4033',
      localCode: '27',
      countryCode: '+55',
      isPrimary: true
    } as PhoneValueObject,
    {
      number: '98883-2732',
      localCode: '27',
      countryCode: '+55',
      isPrimary: true
    } as PhoneValueObject,
    {
      number: '99737-5850',
      localCode: '27',
      countryCode: '+55',
      isPrimary: true
    } as PhoneValueObject
  ]
},
{
  id: 'b1ffc4d2-1a2b-4c3d-9e8f-7a6b5c4d3e02',
  createdAt: now,
  updatedAt: now,
  firstName: 'Barack',
  lastName: 'Obama',
  emails: [{
    email: 'user2@xpertminds.dev',
    type: EEmailType.work,
    isPrimary: true
  } as EmailValueObject],
  avatar: 'avatar.png',
  username: 'user2',
  password: buildSeedCredential('user2'),
  organization: organizations[0].id,
  roles: [
    'access_allow',
    'create_transaction',
    'read_account',
    'read_transaction',
    // 'create_user',
    'read_user'
    // 'update_user',
    // 'delete_user'
  ]
},
{
  id: 'b1ffc4d2-1a2b-4c3d-9e8f-7a6b5c4d3e03',
  createdAt: now,
  updatedAt: now,
  firstName: 'Jimmy',
  lastName: 'Carter',
  emails: [{
    email: 'user3@xpertminds.dev',
    type: EEmailType.work,
    isPrimary: true
  } as EmailValueObject],
  avatar: 'avatar.png',
  username: 'user3@xpertminds.dev',
  password: buildSeedCredential('user3'),
  organization: organizations[1].id,
  roles: [
    'access_allow',
    'read_account',
    'read_transaction',
    // 'create_user',
    'read_user'
    // 'update_user',
    // 'delete_user'
  ]
},
{
  id: 'b1ffc4d2-1a2b-4c3d-9e8f-7a6b5c4d3e04',
  createdAt: now,
  updatedAt: now,
  firstName: 'James',
  lastName: 'Bush',
  emails: [{
    email: 'user4@xpertminds.dev',
    type: EEmailType.work,
    isPrimary: true
  } as EmailValueObject],
  avatar: 'avatar.png',
  username: 'user4@xpertminds.dev',
  password: buildSeedCredential('user4'),
  organization: organizations[1].id,
  roles: [
    'access_allow',
    'create_transaction'
  ]
}
];
export default users;
