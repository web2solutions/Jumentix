import throwIfOASInputValidationFails from '@src/interface/HTTP/validators/throwIfOASInputValidationFails';
import type { OpenAPIV3 } from 'openapi-types';

/**
 * The message a rejected request body comes back with (JUM-681).
 *
 * The validator's job is not only to refuse — it is to refuse in words the
 * caller can act on. The raw message from the schema walker names the JSON
 * path and the keyword (`payload.password: minLength is 8`), which is fine in a
 * log and useless in a form. The rewrite turns it into the sentence the API
 * contract promises.
 *
 * Two of these matter beyond wording:
 *
 * - `updatePassword` is exempted from the "must have at least N chars" rewrite
 *   for an empty value, because there the empty field means "you did not type
 *   your new password", not "your password is too short".
 * - A message that names no field, or a payload that is not an object, has to
 *   pass through unchanged rather than being rewritten around a field that does
 *   not exist.
 *
 * The spec below is a real (small) OpenAPI document, and the validator is the
 * production one — nothing here is doubled.
 */
const spec = {
  openapi: '3.0.3',
  info: { title: 'test', version: '1.0.0' },
  paths: {},
  components: {
    schemas: {
      Credentials: {
        type: 'object',
        properties: {
          username: { type: 'string', minLength: 3 },
          password: { type: 'string', minLength: 8 },
          role: { type: 'string', enum: ['admin', 'member'] }
        },
        required: ['username', 'password']
      }
    }
  }
} as unknown as OpenAPIV3.Document;

const endPoint = (operationId?: string, required = true) => ({
  operationId,
  requestBody: {
    required,
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/Credentials' }
      }
    }
  }
});

const reject = (payload: unknown, operationId?: string) => {
  try {
    throwIfOASInputValidationFails(spec, endPoint(operationId), payload);
    return null;
  } catch (error) {
    return (error as Error).message;
  }
};

describe('openAPI input validation messages (JUM-681)', () => {
  it('accepts a payload that satisfies the schema', () => {
    expect.hasAssertions();

    expect(throwIfOASInputValidationFails(spec, endPoint('createUser'), {
      username: 'alice', password: 'longenough', role: 'admin'
    })).toBe(true);
  });

  it('rewrites an empty required string as "can not be empty"', () => {
    expect.hasAssertions();

    // The raw message would name `minLength`, which reads as "too short" for a
    // field the caller left blank.
    expect(reject({ username: '', password: 'longenough' })).toBe('username can not be empty');
  });

  it('rewrites an empty enum value the same way', () => {
    expect.hasAssertions();

    expect(reject({ username: 'alice', password: 'longenough', role: '' }))
      .toBe('role can not be empty');
  });

  it('names the minimum length for an empty password on any other operation', () => {
    expect.hasAssertions();

    // On a create, an empty password is a password that is too short, and the
    // caller needs the number.
    expect(reject({ username: 'alice', password: '' }, 'createUser'))
      .toBe('password must have at least 8 chars.');
  });

  it('says the password is empty rather than short when it is being changed', () => {
    expect.hasAssertions();

    // `updatePassword` with an empty field means the new password was not
    // typed; telling that caller about a minimum length answers a question they
    // did not ask.
    expect(reject({ username: 'alice', password: '' }, 'updatePassword'))
      .toBe('password can not be empty');
  });

  it('names the minimum length for a password that is present and short', () => {
    expect.hasAssertions();

    expect(reject({ username: 'alice', password: 'short' }, 'updatePassword'))
      .toBe('password must have at least 8 chars.');
  });

  it('passes a message through when it names no field of the payload', () => {
    expect.hasAssertions();

    // A type error on the body itself carries no `payload.<field>`, so there is
    // nothing to rewrite and the original has to survive.
    const message = reject('not-an-object');

    expect(message).not.toBeNull();
    expect(message).not.toContain('can not be empty');
  });

  it('accepts a body it was not given when the schema does not require one', () => {
    expect.hasAssertions();

    expect(throwIfOASInputValidationFails(spec, endPoint('createUser', false), undefined))
      .toBe(true);
    expect(throwIfOASInputValidationFails(spec, endPoint('createUser', false), null))
      .toBe(true);
  });

  it('refuses a missing body the schema does require', () => {
    expect.hasAssertions();

    expect(() => throwIfOASInputValidationFails(spec, endPoint('createUser'), undefined))
      .toThrow('Request body is required by OpenAPI schema.');
  });

  it('accepts any payload for an endpoint that declares no body at all', () => {
    expect.hasAssertions();

    expect(throwIfOASInputValidationFails(spec, { operationId: 'listUsers' }, { anything: true }))
      .toBe(true);
  });

  it('ignores the server-managed properties a client echoed back', () => {
    expect.hasAssertions();

    // `createdAt`, `updatedAt` and `deletedAt` are not in the contract's input,
    // and a client that round-trips a record it read must not be refused.
    expect(throwIfOASInputValidationFails(spec, endPoint('createUser'), {
      username: 'alice',
      password: 'longenough',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      deletedAt: null
    })).toBe(true);
  });
});
