import { describe, expect, it } from 'bun:test';

import { fieldDescriptors } from '@/contracts/formSchema';
import { validateAll, validateField } from '@/contracts/oasForm';
import {
  documentMaskCap,
  maskCpf,
  maskPhone,
  maskSsn,
  phoneMaskCap
} from '@/contracts/validation';

const emailDescriptors = fieldDescriptors('RequestCreateEmail');
const emailField = emailDescriptors.find((d) => d.name === 'email')!;
const phoneDescriptors = fieldDescriptors('RequestCreatePhone');
const countryCodeField = phoneDescriptors.find((d) => d.name === 'countryCode')!;
const localCodeField = phoneDescriptors.find((d) => d.name === 'localCode')!;
const updateUserDescriptors = fieldDescriptors('RequestUpdateUser');
const organizationField = updateUserDescriptors.find((d) => d.name === 'organization')!;
const avatarField = updateUserDescriptors.find((d) => d.name === 'avatar')!;
const documentDescriptors = fieldDescriptors('RequestCreateDocument');
const countryIssueField = documentDescriptors.find((d) => d.name === 'countryIssue')!;

describe('OAS facets closed (JUM-768)', () => {
  it('email fields carry format email + pattern + maxLength from the OAS', () => {
    expect.assertions(3);
    expect(emailField.format).toBe('email');
    expect(emailField.pattern).toBe('^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$');
    expect(emailField.maxLength).toBe(254);
  });

  it('email format accepts valid and rejects broken addresses', () => {
    expect.assertions(5);
    expect(validateField(emailField, 'a@b.co')).toBeNull();
    expect(validateField(emailField, 'a@b')).not.toBeNull();
    expect(validateField(emailField, 'a b@c.com')).not.toBeNull();
    expect(validateField(emailField, `${'x'.repeat(250)}@b.co`)).not.toBeNull(); // > 254
    expect(validateField(emailField, '')).toBe('email é obrigatório.');
  });

  it('countryIssue enforces ISO alpha-2 uppercase', () => {
    expect.assertions(4);
    expect(validateField(countryIssueField, 'BR')).toBeNull();
    expect(validateField(countryIssueField, 'br')).not.toBeNull();
    expect(validateField(countryIssueField, 'BRA')).not.toBeNull();
    expect(validateField(countryIssueField, 'B1')).not.toBeNull();
  });

  it('countryCode is an E.164 enum and rejects non-members', () => {
    expect.assertions(5);
    expect(countryCodeField.enum?.length).toBeGreaterThan(100);
    expect(validateField(countryCodeField, '+55')).toBeNull();
    expect(validateField(countryCodeField, '55')).not.toBeNull();
    expect(validateField(countryCodeField, '+9999')).not.toBeNull();
    expect(validateField(countryCodeField, '+5a')).not.toBeNull();
  });

  it('localCode enforces 2-3 digits', () => {
    expect.assertions(3);
    expect(validateField(localCodeField, '27')).toBeNull();
    expect(validateField(localCodeField, '2a')).not.toBeNull();
    expect(validateField(localCodeField, '2777')).not.toBeNull();
  });

  it('organization validates uuid format when present', () => {
    expect.assertions(3);
    expect(validateField(organizationField, 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11')).toBeNull();
    expect(validateField(organizationField, 'abc')).not.toBeNull();
    expect(validateField(organizationField, '')).toBeNull(); // nullable per OAS
  });

  it('avatar respects the 255 cap', () => {
    expect.assertions(2);
    expect(validateField(avatarField, 'a'.repeat(255))).toBeNull();
    expect(validateField(avatarField, 'a'.repeat(256))).not.toBeNull();
  });

  it('masks hard-cap input length (over-typing cannot produce an invalid state)', () => {
    expect.assertions(4);
    expect(maskCpf('12345678901234567')).toBe('123.456.789-01'); // corta no cap
    expect(maskSsn('123456789999')).toBe('123-45-6789');
    expect(maskPhone('+55', '99805403399')).toBe('99805-4033');
    expect(documentMaskCap('CPF', 'BR')).toBe(14);
  });

  it('phone mask cap comes from the OAS mask', () => {
    expect.assertions(2);
    expect(phoneMaskCap('+55')).toBe(10);
    expect(phoneMaskCap('+1')).toBe(8);
  });

  it('drift: a new maxLength in the OAS is enforced with no code change', () => {
    expect.assertions(2);
    const descriptor = { ...avatarField, maxLength: 10 };
    expect(validateField(descriptor, '1234567890')).toBeNull();
    expect(validateField(descriptor, '12345678901')).not.toBeNull();
  });

  it('validateAll blocks an invalid email create before any HTTP shape', () => {
    expect.assertions(2);
    expect(validateAll(emailDescriptors, { email: 'sem-arroba', type: 'work' })).not.toBeNull();
    expect(validateAll(emailDescriptors, { email: 'ok@xpertminds.dev', type: 'work' })).toBeNull();
  });
});
