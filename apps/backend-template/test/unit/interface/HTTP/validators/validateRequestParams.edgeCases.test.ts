import { ValidationError } from '@src/infra/exceptions';
import validateRequestParams from '@src/interface/HTTP/validators/validateRequestParams';

/**
 * Parameter-validation edges the happy-path suite beside this one does not
 * reach: optional parameters that arrive empty, schemas declared as type
 * unions, values that vanish under trimming, and parameters that rely on the
 * `in`/`schema` defaults. Each one is a way a real request is rejected (or
 * accepted) for the wrong reason.
 */
describe('validateRequestParams edge cases', () => {
  it('rejects an optional parameter that arrives as an empty string', () => {
    expect.hasAssertions();

    // Not a required-field failure: the parameter is optional, so the request
    // only fails because an empty string is not a value at all.
    const endPointConfig = {
      parameters: [{
        name: 'filter', required: false, in: 'query', schema: { type: 'string' }
      }]
    };

    expect(() => validateRequestParams(endPointConfig, {}, { filter: '' }))
      .toThrow(new ValidationError('The parameter filter can not be empty.'));
    expect(validateRequestParams(endPointConfig, {}, {})).toBe(true);
  });

  it('defaults the parameter location to path and the schema to an open one', () => {
    expect.hasAssertions();

    const endPointConfig = {
      parameters: [{ name: 'id', required: true }]
    };

    expect(validateRequestParams(endPointConfig, { id: 'any-value' })).toBe(true);
    expect(() => validateRequestParams(endPointConfig, {}))
      .toThrow(new ValidationError('The parameter id is required in path.'));
  });

  it('coerces query strings against union-typed schemas', () => {
    expect.hasAssertions();

    const endPointConfig = {
      parameters: [{
        name: 'page',
        required: false,
        in: 'query',
        schema: { type: ['integer', 'null'], minimum: 1 }
      }]
    };

    expect(validateRequestParams(endPointConfig, {}, { page: '3' })).toBe(true);
    expect(() => validateRequestParams(endPointConfig, {}, { page: '0' }))
      .toThrow(ValidationError);
  });

  it('keeps a whitespace-only query value a string and lets the schema reject it', () => {
    expect.hasAssertions();

    // Trimming to '' and returning the original string is what makes the
    // failure message point at the type rule instead of the required rule.
    const endPointConfig = {
      parameters: [{
        name: 'page',
        required: false,
        in: 'query',
        schema: { type: 'integer' }
      }]
    };

    expect(() => validateRequestParams(endPointConfig, {}, { page: '   ' }))
      .toThrow(ValidationError);
  });

  it('coerces the boolean false literal without rejecting it as empty', () => {
    expect.hasAssertions();

    const endPointConfig = {
      parameters: [{
        name: 'active',
        required: true,
        in: 'query',
        schema: { type: 'boolean' }
      }]
    };

    // `active=false` is a present, valid value — not a missing parameter.
    expect(validateRequestParams(endPointConfig, {}, { active: 'false' })).toBe(true);
  });

  it('validates a required header parameter against its declared schema', () => {
    expect.hasAssertions();

    const endPointConfig = {
      parameters: [{
        name: 'x-request-count',
        required: true,
        in: 'header',
        schema: { type: 'integer' }
      }]
    };

    // Headers arrive typed already (no query-string coercion), so a string
    // fails the integer rule.
    expect(validateRequestParams(endPointConfig, {}, {}, { 'x-request-count': 7 })).toBe(true);
    expect(() => validateRequestParams(endPointConfig, {}, {}, { 'x-request-count': 'seven' }))
      .toThrow(ValidationError);
    expect(() => validateRequestParams(endPointConfig, {}, {}))
      .toThrow(new ValidationError('The parameter x-request-count is required in header.'));
  });
});
