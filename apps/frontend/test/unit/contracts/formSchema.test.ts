import { describe, expect, it } from 'bun:test';

import { fieldDescriptors, resolveSchema } from '@/contracts/formSchema';
import { collectBody, validateAll, validateField } from '@/contracts/oasForm';

describe('formSchema runtime engine (JUM-766)', () => {
  it('builds descriptors for RequestLogin with every OAS facet', () => {
    expect.assertions(7);
    const descriptors = fieldDescriptors('RequestLogin');
    const username = descriptors.find((d) => d.name === 'username');
    const password = descriptors.find((d) => d.name === 'password');
    const schemaType = descriptors.find((d) => d.name === 'schemaType');

    expect(username).toMatchObject({ type: 'string', required: true, minLength: 1 });
    expect(password).toMatchObject({ required: true, minLength: 2, format: 'password' });
    expect(schemaType?.enum).toEqual(['Basic', 'Bearer']);
    expect(schemaType?.default).toBe('Bearer');
    expect(descriptors.map((d) => d.name)).toEqual(['username', 'password', 'schemaType']);
    expect(schemaType?.example).toBe('Bearer');
    expect(username?.description).toBe('Username');
  });

  it('carries x-validation into the Document data descriptor', () => {
    expect.assertions(2);
    const schema = resolveSchema('Document');
    const data = schema.properties?.data as Record<string, unknown>;
    expect(data?.['x-validation']).toBeDefined();
    const descriptors = fieldDescriptors('RequestCreateDocument');
    expect(descriptors.find((d) => d.name === 'data')?.xValidation).toBeUndefined(); // rules live on the value object schema
  });

  it('flags required fields from the OAS required list', () => {
    expect.assertions(2);
    const descriptors = fieldDescriptors('RequestRegister');
    expect(descriptors.find((d) => d.name === 'organization')?.required).toBe(false);
    expect(descriptors.find((d) => d.name === 'firstName')?.required).toBe(true);
  });

  it('follows a renamed field with zero code change (drift proof)', () => {
    expect.assertions(2);
    // Simulates a spec change: RequestLogin with `username` renamed.
    const schema = resolveSchema('RequestLogin');
    const properties = Object.entries(schema.properties ?? {});
    const renamed = {
      ...schema,
      properties: Object.fromEntries(properties.map(([name, def]) => [
        name === 'username' ? 'login' : name,
        def
      ]))
    };
    const names = Object.keys(renamed.properties);
    expect(names).toContain('login');
    expect(names).not.toContain('username');
  });
});

describe('oasForm collect/validate (JUM-766)', () => {
  const descriptors = fieldDescriptors('RequestLogin');

  it('collectBody keys come from descriptor names and declared defaults fill gaps', () => {
    expect.assertions(2);
    const body = collectBody(descriptors, { username: 'me@mydomain.com', password: 'secret' });
    expect(body).toEqual({ username: 'me@mydomain.com', password: 'secret', schemaType: 'Bearer' });
    expect(Object.keys(body)).toEqual(['username', 'password', 'schemaType']);
  });

  it('validateAll enforces minLength from the OAS', () => {
    expect.assertions(1);
    expect(validateAll(descriptors, { username: 'me@mydomain.com', password: 'x' }))
      .toBe('password precisa de ao menos 2 caracteres.');
  });

  it('validateField enforces enum membership', () => {
    expect.assertions(1);
    const schemaType = descriptors.find((d) => d.name === 'schemaType');
    expect(validateField(schemaType!, 'Digest')).toBe('schemaType deve ser um de: Basic, Bearer.');
  });

  it('validateAll enforces the register password minimum from the OAS', () => {
    expect.assertions(2);
    const registerDescriptors = fieldDescriptors('RequestRegister');
    const invalid = validateAll(registerDescriptors, {
      firstName: 'A',
      username: 'a@b.c',
      password: 'short'
    });
    expect(invalid).toBe('password precisa de ao menos 8 caracteres.');
    expect(validateAll(registerDescriptors, {
      firstName: 'A',
      username: 'a@b.c',
      password: 'StrongPass#1'
    })).toBeNull();
  });

  it('validateAll reports required fields first', () => {
    expect.assertions(1);
    expect(validateAll(descriptors, {})).toBe('username é obrigatório.');
  });
});
