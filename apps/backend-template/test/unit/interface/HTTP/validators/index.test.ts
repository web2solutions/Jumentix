import { ValidationError } from '@src/infra/exceptions';
import checkRequiredProperties from '@src/interface/HTTP/validators/checkRequiredProperties';
import getSchema from '@src/interface/HTTP/validators/getSchema';
import isPropertiesMatching from '@src/interface/HTTP/validators/isPropertiesMatching';
import throwIfOASInputValidationFails from '@src/interface/HTTP/validators/throwIfOASInputValidationFails';
import validateRequestAgainstOAS from '@src/interface/HTTP/validators/validateRequestAgainstOAS';
import validateRequestParams from '@src/interface/HTTP/validators/validateRequestParams';

describe('http validators', () => {
  it('validates required properties', () => {
    expect.hasAssertions();
    expect(checkRequiredProperties({ id: '1' }, ['id'])).toBe(true);
    expect(() => checkRequiredProperties({}, ['id'])).toThrow(ValidationError);
    expect(() => checkRequiredProperties({ id: null }, ['id'])).toThrow(ValidationError);
  });

  it('checks payload properties against schema properties', () => {
    expect.hasAssertions();
    expect(isPropertiesMatching({ id: 1 }, { id: { type: 'string' } })).toBe(true);
    expect(() => isPropertiesMatching({ unknown: true }, { id: { type: 'string' } })).toThrow(
      ValidationError
    );
  });

  it('gets schema from oas content ref', () => {
    expect.hasAssertions();
    const spec = {
      components: {
        schemas: {
          RequestCreateUser: {
            properties: { firstName: { type: 'string' } },
            required: ['firstName']
          }
        }
      }
    } as any;
    const content = {
      'application/json': {
        schema: {
          $ref: '#/components/schemas/RequestCreateUser'
        }
      }
    };

    expect(getSchema(spec, content)?.required).toStrictEqual(['firstName']);
    expect(getSchema({} as any, content)).toBeUndefined();

    expect(getSchema(spec, {
      'application/json': {
        schema: {
          type: 'object',
          required: ['name'],
          properties: { name: { type: 'string' } }
        }
      }
    })?.required).toStrictEqual(['name']);

    expect(getSchema(spec, {
      'application/json': {
        schema: {
          $ref: 'components/schemas/RequestCreateUser'
        }
      }
    })).toBeUndefined();

    expect(getSchema(spec, {
      'application/json': {
        schema: {
          $ref: '#/components/schemas/RequestCreateUser/properties/firstName/type'
        }
      }
    })).toBe('string');
  });

  it('returns undefined when content or schema are missing', () => {
    expect.hasAssertions();
    const spec = { components: { schemas: {} } } as any;
    expect(getSchema(spec, undefined as any)).toBeUndefined();
    expect(getSchema(spec, {} as any)).toBeUndefined();
    expect(getSchema(spec, { 'application/json': {} } as any)).toBeUndefined();
  });

  it('returns undefined when ref traversal reaches non-object node', () => {
    expect.hasAssertions();
    const spec = {
      components: {
        schemas: {
          RequestCreateUser: {
            properties: { firstName: { type: 'string' } }
          }
        }
      }
    } as any;
    expect(getSchema(spec, {
      'application/json': {
        schema: {
          $ref: '#/components/schemas/RequestCreateUser/properties/firstName/type/value'
        }
      }
    })).toBeUndefined();
  });

  it('validates payload against endpoint request body schema', () => {
    expect.hasAssertions();
    const spec = {
      components: {
        schemas: {
          RequestCreateUser: {
            properties: { firstName: { type: 'string' } },
            required: ['firstName']
          }
        }
      }
    } as any;
    const endPointConfig = {
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/RequestCreateUser'
            }
          }
        }
      }
    };

    expect(throwIfOASInputValidationFails(spec, endPointConfig, { firstName: 'John' })).toBe(true);
    expect(() => throwIfOASInputValidationFails(spec, endPointConfig, {})).toThrow(ValidationError);
  });

  it('validates payload format/type rules from schema', () => {
    expect.hasAssertions();
    const spec = {
      components: {
        schemas: {
          RequestCreateUser: {
            type: 'object',
            required: ['username', 'age'],
            properties: {
              username: { type: 'string', format: 'email' },
              age: { type: 'integer', minimum: 18 }
            }
          }
        }
      }
    } as any;
    const endPointConfig = {
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/RequestCreateUser'
            }
          }
        }
      }
    };

    expect(() => throwIfOASInputValidationFails(spec, endPointConfig, {
      username: 'john@example.com',
      age: 18
    })).not.toThrow();

    expect(() => throwIfOASInputValidationFails(spec, endPointConfig, {
      username: 'not-an-email',
      age: 18
    })).toThrow(ValidationError);

    expect(() => throwIfOASInputValidationFails(spec, endPointConfig, {
      username: 'john@example.com',
      age: 10
    })).toThrow(ValidationError);

    expect(() => throwIfOASInputValidationFails(spec, endPointConfig, undefined)).toThrow(
      'Request body is required by OpenAPI schema.'
    );

    expect(throwIfOASInputValidationFails(spec, {
      requestBody: {
        required: false,
        content: endPointConfig.requestBody.content
      }
    }, null)).toBe(true);
  });

  it('preserves stable public validation messages and ordering', () => {
    expect.hasAssertions();
    const spec = {
      components: {
        schemas: {
          RequestCreateUser: {
            type: 'object',
            required: ['firstName', 'password', 'type'],
            properties: {
              firstName: { type: 'string' },
              password: { type: 'string', minLength: 8 },
              type: { type: 'string', enum: ['work', 'home'] }
            }
          }
        }
      }
    } as any;
    const requestBody = {
      required: true,
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/RequestCreateUser'
          }
        }
      }
    };

    expect(() => throwIfOASInputValidationFails(spec, {
      operationId: 'create',
      requestBody
    }, { invalidFieldName: true })).toThrow(
      'The property invalidFieldName from input payload does not exist.'
    );
    expect(() => throwIfOASInputValidationFails(spec, {
      operationId: 'create',
      requestBody
    }, { firstName: 'John', password: '', type: 'work' })).toThrow(
      'password must have at least 8 chars.'
    );
    expect(() => throwIfOASInputValidationFails(spec, {
      operationId: 'updatePassword',
      requestBody
    }, { firstName: 'John', password: '', type: 'work' })).toThrow(
      'password can not be empty'
    );
    expect(() => throwIfOASInputValidationFails(spec, {
      operationId: 'create',
      requestBody
    }, { firstName: 'John', password: 'password', type: '' })).toThrow(
      'type can not be empty'
    );
  });

  it('allows server-managed timestamps in update round trips', () => {
    expect.hasAssertions();
    const spec = {
      components: {
        schemas: {
          RequestUpdateUser: {
            type: 'object',
            required: ['firstName'],
            properties: {
              firstName: { type: 'string' }
            }
          }
        }
      }
    } as any;
    const endPointConfig = {
      operationId: 'update',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/RequestUpdateUser'
            }
          }
        }
      }
    };

    expect(throwIfOASInputValidationFails(spec, endPointConfig, {
      firstName: 'John',
      createdAt: '2026-07-25T00:00:00.000Z',
      updatedAt: '2026-07-25T00:00:00.000Z',
      deletedAt: null
    })).toBe(true);
    expect(() => throwIfOASInputValidationFails(spec, endPointConfig, {
      firstName: 'John',
      unexpected: true
    })).toThrow('The property unexpected from input payload does not exist.');
  });

  it('validates request path params', () => {
    expect.hasAssertions();
    const endPointConfig = {
      parameters: [{ name: 'id', required: true }]
    };
    expect(validateRequestParams(endPointConfig, { id: '1' })).toBe(true);
    expect(validateRequestParams({}, {})).toBe(true);
    expect(() => validateRequestParams(endPointConfig, {} as any)).toThrow(ValidationError);
    expect(() => validateRequestParams(endPointConfig, { id: '' })).toThrow(ValidationError);
    expect(() => validateRequestParams(endPointConfig, { id: 'null' })).toThrow(ValidationError);
  });

  it('validates request query params against schema', () => {
    expect.hasAssertions();
    const endPointConfig = {
      parameters: [{
        name: 'page',
        in: 'query',
        required: false,
        schema: { type: 'integer', minimum: 1 }
      }]
    };

    expect(validateRequestParams(endPointConfig, {}, { page: 1 })).toBe(true);
    expect(() => validateRequestParams(endPointConfig, {}, { page: 0 })).toThrow(ValidationError);
    expect(() => validateRequestParams(endPointConfig, {}, { page: 'x' })).toThrow(ValidationError);

    const headerConfig = {
      parameters: [{
        name: 'x-tenant-id',
        in: 'header',
        required: true,
        schema: { type: 'string', minLength: 1 }
      }]
    };
    expect(() => validateRequestParams(headerConfig, {}, {}, { 'x-tenant-id': '' })).toThrow(ValidationError);
    expect(validateRequestParams(headerConfig, {}, {}, { 'x-tenant-id': 'tenant-1' })).toBe(true);
  });

  it('validates full request against OAS (params + body)', () => {
    expect.hasAssertions();
    const spec = {
      components: {
        schemas: {
          RequestCreateUser: {
            type: 'object',
            required: ['firstName'],
            properties: { firstName: { type: 'string', minLength: 2 } }
          }
        }
      }
    } as any;
    const endPointConfig = {
      parameters: [{
        name: 'id',
        in: 'path',
        required: true,
        schema: { type: 'string', minLength: 1 }
      }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/RequestCreateUser'
            }
          }
        }
      }
    };

    expect(validateRequestAgainstOAS(spec, endPointConfig, {
      params: { id: '1' },
      input: { firstName: 'John' },
      authorization: 'Bearer token'
    })).toBe(true);

    expect(() => validateRequestAgainstOAS(spec, endPointConfig, {
      params: { id: '' },
      input: { firstName: 'John' }
    })).toThrow(ValidationError);
  });
});

/**
 * The barrel, exercised through the barrel.
 *
 * Every test above imports the validators by their individual paths, so the
 * re-exports in `validators/index.ts` were never loaded — a barrel that dropped
 * or misnamed an export would not have failed anything here.
 *
 * That is not a theoretical shape in this repository: `HTTP/ports/index.ts`
 * carries a comment about exactly this class of bug, where `import type` erasure
 * left a value re-export resolving to a binding that does not exist and the
 * whole barrel failed to load.
 *
 * Function coverage on this file was previously supplied by an unrelated suite:
 * `controllers.test.ts` spread `jest.requireActual('@src/interface/HTTP/validators')`
 * into a mock, and spreading touches every re-export getter. Removing that dead
 * mock (JUM-583) revealed the barrel had no coverage of its own.
 */
describe('validateRequestParams query coercion (JUM-777)', () => {
  const endPoint = {
    parameters: [
      { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1 } },
      { name: 'size', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100 } },
      { name: 'active', in: 'query', schema: { type: 'boolean' } }
    ]
  };

  it('coerces numeric and boolean query strings before validating their schema', () => {
    expect.hasAssertions();
    expect(validateRequestParams(endPoint, {}, { page: '2', size: '30', active: 'true' })).toBe(true);
    expect(validateRequestParams(endPoint, {}, { page: 1 })).toBe(true);
  });

  it('still rejects values that do not parse or violate the bounds', () => {
    expect.hasAssertions();
    expect(() => validateRequestParams(endPoint, {}, { page: 'two' })).toThrow(ValidationError);
    expect(() => validateRequestParams(endPoint, {}, { page: '0' })).toThrow(ValidationError);
    expect(() => validateRequestParams(endPoint, {}, { size: '101' })).toThrow(ValidationError);
    expect(() => validateRequestParams(endPoint, {}, { active: 'yes' })).toThrow(ValidationError);
  });
});

describe('http validators barrel', () => {
  it.each([
    'throwIfOASInputValidationFails',
    'isPropertiesMatching',
    'getSchema',
    'checkRequiredProperties',
    'validateRequestParams',
    'validateRequestAgainstOAS'
  ])('re-exports %s as a callable', async (name) => {
    expect.hasAssertions();
    const barrel = await import('@src/interface/HTTP/validators') as Record<string, unknown>;

    expect(typeof barrel[name]).toBe('function');
  });

  it('re-exports the same function objects the modules define', async () => {
    expect.hasAssertions();
    // Identity, not just presence: a barrel that wrapped or shadowed an export
    // would still pass a `typeof` check while changing behaviour.
    const barrel = await import('@src/interface/HTTP/validators');

    expect(barrel.checkRequiredProperties).toBe(checkRequiredProperties);
    expect(barrel.getSchema).toBe(getSchema);
    expect(barrel.isPropertiesMatching).toBe(isPropertiesMatching);
  });

  it('re-exports the same validation functions the modules define', async () => {
    expect.hasAssertions();
    const barrel = await import('@src/interface/HTTP/validators');

    expect(barrel.throwIfOASInputValidationFails).toBe(throwIfOASInputValidationFails);
    expect(barrel.validateRequestParams).toBe(validateRequestParams);
    expect(barrel.validateRequestAgainstOAS).toBe(validateRequestAgainstOAS);
  });
});
