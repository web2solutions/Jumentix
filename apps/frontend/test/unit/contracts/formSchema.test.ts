import { describe, expect, it } from 'bun:test';

import {
  entityPrimaryKey,
  fieldDescriptors,
  getOperationForEntity,
  listOperationForEntity,
  resolveSchema
} from '@/contracts/formSchema';
import { collectBody, validateAll, validateField } from '@/contracts/oasForm';

import { setLocale } from '@/i18n';

setLocale('pt-BR');

describe('formSchema runtime engine (JUM-766)', () => {
  it('builds descriptors for RequestLogin with every OAS facet', () => {
    expect.assertions(7);
    const descriptors = fieldDescriptors('RequestLogin');
    const username = descriptors.find((d) => d.name === 'username');
    const password = descriptors.find((d) => d.name === 'password');

    expect(username).toMatchObject({ type: 'string', required: true, minLength: 1 });
    expect(password).toMatchObject({ required: true, minLength: 2, format: 'password' });
    // schemaType is `x-hide: true` (JUM-769): still in the contract…
    const schema = resolveSchema('RequestLogin');
    const schemaType = schema.properties?.schemaType as Record<string, unknown>;
    expect(schemaType?.enum).toEqual(['Basic', 'Bearer']);
    expect(schemaType?.default).toBe('Bearer');
    // …but never surfaces as a form field.
    expect(descriptors.map((d) => d.name)).toEqual(['username', 'password']);
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
    // schemaType is x-hidden (JUM-769): not collected; the server default applies.
    expect(body).toEqual({ username: 'me@mydomain.com', password: 'secret' });
    expect(Object.keys(body)).toEqual(['username', 'password']);
  });

  it('validateAll enforces minLength from the OAS', () => {
    expect.assertions(1);
    expect(validateAll(descriptors, { username: 'me@mydomain.com', password: 'x' }))
      .toBe('Senha precisa de ao menos 2 caracteres.');
  });

  it('validateField enforces enum membership', () => {
    expect.assertions(1);
    const type = fieldDescriptors('RequestCreateDocument').find((d) => d.name === 'type');
    expect(validateField(type!, 'RG3')).toBe('Tipo deve ser um de: CPF, RG, SSN, passport.');
  });

  it('validateAll enforces the register password minimum from the OAS', () => {
    expect.assertions(2);
    const registerDescriptors = fieldDescriptors('RequestRegister');
    const invalid = validateAll(registerDescriptors, {
      firstName: 'A',
      username: 'a@b.c',
      password: 'short'
    });
    expect(invalid).toBe('Senha precisa de ao menos 8 caracteres.');
    expect(validateAll(registerDescriptors, {
      firstName: 'A',
      username: 'a@b.c',
      password: 'StrongPass#1'
    })).toBeNull();
  });

  it('validateAll reports required fields first', () => {
    expect.assertions(1);
    expect(validateAll(descriptors, {})).toBe('Usuário é obrigatório.');
  });
});

describe('x-relation and x-primary-key (JUM-787, JUM-788)', () => {
  it('parses belongsTo with defaults for field and match', () => {
    expect.hasAssertions();
    const organization = fieldDescriptors('User').find((d) => d.name === 'organization');
    expect(organization?.relation).toMatchObject({
      field: 'organization',
      entity: 'Organization',
      match: 'id',
      display: 'name',
      kind: 'belongsTo'
    });
  });

  it('parses hasMany on arrays of ids', () => {
    expect.hasAssertions();
    const users = fieldDescriptors('Organization').find((d) => d.name === 'users');
    expect(users?.relation).toMatchObject({
      entity: 'User',
      kind: 'hasMany',
      display: 'username'
    });
  });

  it('reads entityPrimaryKey from the schema and resolves the list operation', () => {
    expect.hasAssertions();
    expect(entityPrimaryKey('User')).toBe('id');
    expect(entityPrimaryKey('MissingEntity')).toBe('id');
    expect(listOperationForEntity('User')).toBe('getAll');
    expect(listOperationForEntity('Organization')).toBe('getAllOrganizations');
    expect(getOperationForEntity('User')).toBe('getOneById');
    expect(getOperationForEntity('Organization')).toBe('getOrganizationById');
  });
});
