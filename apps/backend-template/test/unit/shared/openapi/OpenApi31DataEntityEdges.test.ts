import {
  mapDataEntityToOpenApiSchema,
  throwIfDataEntityIsNotOpenApi31Compliant,
  throwIfDataEntityPayloadIsNotOpenApi31Compliant,
  throwIfFieldDefinitionIsNotOpenApi31Compliant
} from '@src/shared/openapi/OpenApi31DataEntity';

/**
 * How validation rules are written down, and what happens at the edges
 * (JUM-681).
 *
 * A field's constraints arrive as strings — `minLength:3`, `enum=a|b`,
 * `required:["id"]` — because that is what the designer stores and what the CLI
 * types. Parsing them is where a schema silently loses a rule: an `enum` that
 * ends up a string instead of a list, a numeric bound parsed as text, a
 * malformed JSON value that throws instead of degrading. The resulting schema
 * still validates, and validates the wrong thing.
 *
 * The suite next to this one covers the common shapes. These are the edges:
 * both separators, every value shape the parser recognises, the absent lists
 * that must not be iterated, and the type mismatches that must be named rather
 * than passed through.
 */
const field = (overrides: Record<string, unknown> = {}) => ({
  name: 'value',
  type: 'string',
  required: false,
  validations: [],
  ...overrides
}) as never;

describe('validation rule parsing (JUM-681)', () => {
  it('accepts both the colon and the equals separator', () => {
    expect.hasAssertions();

    const schema = mapDataEntityToOpenApiSchema({
      name: 'Sample',
      fields: [
        field({ name: 'a', validations: ['minLength:3'] }),
        field({ name: 'b', validations: ['maxLength=8'] })
      ]
    } as never);

    expect(schema.properties.a.minLength).toBe(3);
    expect(schema.properties.b.maxLength).toBe(8);
  });

  it('reads booleans, numbers and empty values as themselves', () => {
    expect.hasAssertions();

    // `uniqueItems:true` as the string "true" is truthy either way — until a
    // consumer compares it to `false`.
    const schema = mapDataEntityToOpenApiSchema({
      name: 'Sample',
      fields: [
        field({ name: 'list', type: 'array', validations: ['uniqueItems:true', 'minItems:0'] }),
        field({ name: 'flag', type: 'boolean', validations: ['enum:false'] }),
        field({ name: 'text', validations: ['pattern:'] })
      ]
    } as never);

    expect(schema.properties.list.uniqueItems).toBe(true);
    expect(schema.properties.list.minItems).toBe(0);
    expect(schema.properties.flag.enum).toStrictEqual([false]);
    expect(schema.properties.text.pattern).toBe('');
  });

  it('reads a JSON array or object value', () => {
    expect.hasAssertions();

    const schema = mapDataEntityToOpenApiSchema({
      name: 'Sample',
      fields: [
        field({ name: 'choice', validations: ['enum:["a","b"]'] }),
        field({ name: 'bag', type: 'object', validations: ['required:["id"]'] })
      ]
    } as never);

    expect(schema.properties.choice.enum).toStrictEqual(['a', 'b']);
    expect(schema.properties.bag.required).toStrictEqual(['id']);
  });

  it('keeps a malformed JSON value as the text it was', () => {
    expect.hasAssertions();

    // Throwing here would take down the whole schema build over one typo in one
    // rule; keeping the raw text makes the mistake visible in the schema.
    const schema = mapDataEntityToOpenApiSchema({
      name: 'Sample',
      fields: [field({ name: 'broken', validations: ['pattern:[unclosed'] })]
    } as never);

    expect(schema.properties.broken.pattern).toBe('[unclosed');
  });

  it('splits a list on a pipe or a comma', () => {
    expect.hasAssertions();

    const schema = mapDataEntityToOpenApiSchema({
      name: 'Sample',
      fields: [
        field({ name: 'piped', validations: ['enum:red|green'] }),
        field({ name: 'commas', validations: ['enum:red, green'] })
      ]
    } as never);

    expect(schema.properties.piped.enum).toStrictEqual(['red', 'green']);
    expect(schema.properties.commas.enum).toStrictEqual(['red', 'green']);
  });

  it('wraps a single enum value in a list', () => {
    expect.hasAssertions();

    // `enum` is a list in OpenAPI. A bare value has to become a one-item list,
    // or the schema declares an enum no value can satisfy.
    const schema = mapDataEntityToOpenApiSchema({
      name: 'Sample',
      fields: [field({ name: 'only', validations: ['enum:red'] })]
    } as never);

    expect(schema.properties.only.enum).toStrictEqual(['red']);
  });

  it('carries a real format and drops the placeholder one', () => {
    expect.hasAssertions();

    const schema = mapDataEntityToOpenApiSchema({
      name: 'Sample',
      fields: [
        field({ name: 'when', format: 'date' }),
        field({ name: 'plain', format: 'none' }),
        field({ name: 'blank', format: '   ' }),
        field({ name: 'missing' })
      ]
    } as never);

    expect(schema.properties.when.format).toBe('date');
    expect(schema.properties.plain.format).toBeUndefined();
    expect(schema.properties.blank.format).toBeUndefined();
    expect(schema.properties.missing.format).toBeUndefined();
  });

  it('lists the required fields and refuses extra ones', () => {
    expect.hasAssertions();

    const schema = mapDataEntityToOpenApiSchema({
      name: 'Sample',
      fields: [field({ name: 'id', required: true }), field({ name: 'note' })]
    } as never);

    expect(schema.required).toStrictEqual(['id']);
    expect(schema.additionalProperties).toBe(false);
  });
});

describe('entity and field compliance (JUM-681)', () => {
  it('accepts an entity and a field that declare no validations at all', () => {
    expect.hasAssertions();

    // `validations` is optional in the stored shape; iterating an absent list
    // is a crash on the way into the schema builder.
    expect(() => throwIfFieldDefinitionIsNotOpenApi31Compliant({
      name: 'value', type: 'string'
    } as never)).not.toThrow();
    expect(() => throwIfDataEntityIsNotOpenApi31Compliant({ name: 'Sample' } as never))
      .not.toThrow();
  });

  it('refuses an entity with no name', () => {
    expect.hasAssertions();

    expect(() => throwIfDataEntityIsNotOpenApi31Compliant({ name: '  ' } as never))
      .toThrow('OpenAPI 3.1 entity name is required.');
  });

  it('refuses a field with no name, a bad type, or a non-boolean required flag', () => {
    expect.hasAssertions();

    expect(() => throwIfFieldDefinitionIsNotOpenApi31Compliant(field({ name: '  ' })))
      .toThrow('OpenAPI 3.1 field name is required.');
    expect(() => throwIfFieldDefinitionIsNotOpenApi31Compliant(field({ type: 'date' })))
      .toThrow('invalid field type "date"');
    expect(() => throwIfFieldDefinitionIsNotOpenApi31Compliant(field({ required: 'yes' })))
      .toThrow('invalid required flag');
  });

  it('refuses a format the type does not have, and a rule the type does not have', () => {
    expect.hasAssertions();

    expect(() => throwIfFieldDefinitionIsNotOpenApi31Compliant(field({ format: 'uuid', type: 'number' })))
      .toThrow('invalid format "uuid" for type "number"');
    expect(() => throwIfFieldDefinitionIsNotOpenApi31Compliant(field({ validations: ['minItems:1'] })))
      .toThrow('invalid validation "minItems" for type "string"');
  });
});

describe('payload validation type mismatches (JUM-681)', () => {
  const entityWith = (type: string, extra: Record<string, unknown> = {}) => ({
    name: 'Sample',
    fields: [field({
      name: 'value', type, required: true, ...extra
    })]
  }) as never;

  it('rejects every scalar mismatch, naming the field', () => {
    expect.hasAssertions();

    // The per-type check runs inside the union match, so the message a caller
    // sees names the accepted types and the path — the field, not the value.
    expect(() => throwIfDataEntityPayloadIsNotOpenApi31Compliant({ value: 1 }, entityWith('string')))
      .toThrow('Sample.value": expected one of [string]');
    expect(() => throwIfDataEntityPayloadIsNotOpenApi31Compliant({ value: '1' }, entityWith('number')))
      .toThrow('expected one of [number]');
    expect(() => throwIfDataEntityPayloadIsNotOpenApi31Compliant({ value: 1.5 }, entityWith('integer')))
      .toThrow('expected one of [integer]');
    expect(() => throwIfDataEntityPayloadIsNotOpenApi31Compliant({ value: 'x' }, entityWith('boolean')))
      .toThrow('expected one of [boolean]');
  });

  it('separates an array from an object in both directions', () => {
    expect.hasAssertions();

    // `typeof []` is "object", so an array passed where an object belongs is the
    // mismatch a naive check waves through.
    expect(() => throwIfDataEntityPayloadIsNotOpenApi31Compliant(
      { value: { a: 1 } },
      entityWith('array')
    )).toThrow('expected one of [array]');
    expect(() => throwIfDataEntityPayloadIsNotOpenApi31Compliant(
      { value: [1] },
      entityWith('object')
    )).toThrow('expected one of [object]');
    expect(() => throwIfDataEntityPayloadIsNotOpenApi31Compliant(
      { value: 'x' },
      entityWith('object')
    )).toThrow('expected one of [object]');
  });

  it('reports a required field that is present but null', () => {
    expect.hasAssertions();

    // Present-and-null is the shape a form sends for "cleared", and it is not
    // the same as provided.
    expect(() => throwIfDataEntityPayloadIsNotOpenApi31Compliant(
      { value: null },
      entityWith('string')
    )).toThrow('is required');
    expect(() => throwIfDataEntityPayloadIsNotOpenApi31Compliant({}, entityWith('string')))
      .toThrow('is required');
  });

  it('accepts a payload that satisfies every declared rule', () => {
    expect.hasAssertions();

    expect(() => throwIfDataEntityPayloadIsNotOpenApi31Compliant(
      { value: 'abc' },
      entityWith('string', { validations: ['minLength:2', 'maxLength:5'] })
    )).not.toThrow();
  });
});
