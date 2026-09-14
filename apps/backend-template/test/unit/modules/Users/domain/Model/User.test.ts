/* eslint-disable jest/max-expects */
import { User } from '@src/modules/Users/domain/Model/User';
import { EDocumentType } from '@src/modules/ddd/valueObjects/EDocumentType';
import { EEmailType } from '@src/modules/ddd/valueObjects/EEmailType';

const basePayload = () => ({
  firstName: 'John',
  lastName: 'Doe',
  username: 'john',
  organization: '00000000-0000-4000-8000-000000000099',
  password: '12345678',
  salt: 'salt',
  avatar: 'avatar.png',
  emails: [{
    id: '00000000-0000-4000-8000-000000000011', email: 'john@example.com', type: EEmailType.personal, isPrimary: true
  }],
  documents: [{
    id: '00000000-0000-4000-8000-000000000012', type: EDocumentType.CPF, countryIssue: 'BR', data: '11111111111'
  }],
  phones: [{
    id: '00000000-0000-4000-8000-000000000013', countryCode: '55', localCode: '11', number: '999999999', isPrimary: true
  }],
  roles: ['user']
});

describe('user domain model', () => {
  it('exposes openapi 3.1 compliant data entity schema', () => {
    expect.hasAssertions();
    expect(User.dataEntitySchema.name).toBe('User');
    expect(User.dataEntitySchema.fields).toStrictEqual(expect.arrayContaining([
      expect.objectContaining({
        name: 'id',
        format: 'uuid'
      })
    ]));
  });

  it('creates and mutates aggregate value objects', () => {
    expect.hasAssertions();
    const user = new User(basePayload());

    expect(user.firstName).toBe('John');
    user.firstName = 'Mary';
    user.lastName = 'Jane';
    user.avatar = 'avatar2.png';
    user.username = 'mary';
    user.password = 'new-password';
    user.salt = 'new-salt';
    expect(user.firstName).toBe('Mary');
    expect(user.roles).toContain('user');

    user.createPhone({ countryCode: '1', localCode: '212', number: '1111111' });
    const phoneId = user.phones[0].id;
    expect(user.updatePhone({
      id: phoneId, countryCode: '1', localCode: '646', number: '2222222'
    })).toBe(true);
    expect(user.deletePhone(phoneId)).toBe(true);
    expect(user.deletePhone('missing')).toBe(false);

    user.createDocument({ type: EDocumentType.RG, countryIssue: 'BR', data: '222' });
    const documentId = user.documents[0].id;
    expect(user.updateDocument({
      id: documentId, type: EDocumentType.SSN, countryIssue: 'US', data: '333'
    })).toBe(true);
    expect(user.deleteDocument(documentId)).toBe(true);
    expect(user.deleteDocument('missing')).toBe(false);

    user.createEmail({ email: 'jane@example.com', type: EEmailType.work });
    const emailId = user.emails[0].id;
    expect(user.updateEmail({ id: emailId, email: 'jane+1@example.com', type: EEmailType.work })).toBe(true);
    expect(user.deleteEmail(emailId)).toBe(true);
    expect(user.deleteEmail('missing')).toBe(false);
  });

  it('returns false when updating a value object id the aggregate does not hold', () => {
    expect.hasAssertions();

    // The update has to answer "not found" without touching the aggregate —
    // a false return, and the existing value objects stay exactly as built.
    const user = new User(basePayload());
    const { phones, documents, emails } = user;

    expect(user.updatePhone({
      id: 'missing', countryCode: '1', localCode: '212', number: '1111111'
    })).toBe(false);
    expect(user.updateDocument({
      id: 'missing', type: EDocumentType.RG, countryIssue: 'BR', data: '222'
    })).toBe(false);
    expect(user.updateEmail({
      id: 'missing', email: 'jane@example.com', type: EEmailType.work
    })).toBe(false);
    expect(user.phones).toStrictEqual(phones);
    expect(user.documents).toStrictEqual(documents);
    expect(user.emails).toStrictEqual(emails);
  });

  it('enforces read only fields', () => {
    expect.hasAssertions();
    const user = new User({ ...basePayload(), readOnly: true });
    expect(() => { user.firstName = 'Mary'; }).toThrow('read only');
    expect(() => { user.createEmail({ email: 'new@example.com', type: EEmailType.work }); }).toThrow('read only');
  });

  it('requires organization for normalized tenant roles', () => {
    expect.hasAssertions();
    expect(() => new User({
      ...basePayload(),
      organization: '',
      roles: ['admin']
    })).toThrow('organization is required');
  });
});

/**
 * The user a minimal payload produces (JUM-721).
 *
 * Every other test here builds a complete user. Registration does not: it
 * carries a name, a username and an email, and the aggregate fills the rest.
 * Each fallback decides what a store persists and what a later read compares
 * against — `undefined` for `organization` is not the same as `''` to a query
 * that filters on it, and `roles: undefined` reaching the role normaliser is a
 * crash on the first authorisation check rather than an empty role set.
 */
describe('user aggregate defaults (JUM-721)', () => {
  const minimalPayload = () => ({
    firstName: 'Ada',
    username: 'ada',
    emails: [{
      id: '00000000-0000-4000-8000-0000000000a1',
      email: 'ada@example.com',
      type: EEmailType.personal,
      isPrimary: true
    }]
  });

  it('fills every optional field a registration does not carry', () => {
    expect.hasAssertions();

    const user = new User(minimalPayload() as never);

    expect({
      lastName: user.lastName,
      avatar: user.avatar,
      organization: user.organization,
      password: user.password,
      salt: user.salt,
      roles: user.roles
    }).toStrictEqual({
      lastName: '',
      avatar: 'avatar.png',
      organization: '',
      password: '',
      salt: '',
      roles: []
    });

    // `readOnly` is private and has no getter, so the assertion is on its
    // effect: a user that did not ask to be read-only accepts a mutation.
    expect(() => { user.firstName = 'Grace'; }).not.toThrow();
  });

  it('accepts a payload with no documents and no phones', () => {
    expect.hasAssertions();

    // Both are optional collections. Iterating an absent one is a crash in the
    // constructor, which is where a registration would fail with no useful
    // message at all.
    const user = new User(minimalPayload() as never);

    expect(user.documents).toStrictEqual([]);
    expect(user.phones).toStrictEqual([]);
    expect(user.emails).toHaveLength(1);
  });

  it('keeps a read-only flag the payload does declare', () => {
    expect.hasAssertions();

    // The seeded users are read-only, and the flag is what stops a test run
    // from mutating them.
    const user = new User({ ...minimalPayload(), readOnly: true } as never);

    expect(() => { user.firstName = 'Grace'; }).toThrow('read only');
  });
});
