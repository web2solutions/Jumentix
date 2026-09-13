import { describe, expect, it } from 'bun:test';

import {
  documentRuleFor,
  isValidCpf,
  maskCpf,
  maskPhone,
  maskSsn,
  phoneRuleFor,
  validateDocumentData,
  validatePhone
} from '@/contracts/validation';

import { setLocale } from '@/i18n';

setLocale('pt-BR');

describe('validation module driven by the OAS x-validation (JUM-765)', () => {
  it('reads the CPF rule from the bundled OAS', () => {
    expect.assertions(3);
    const rule = documentRuleFor('CPF', 'BR');
    expect(rule?.pattern).toBe('^\\d{3}\\.?\\d{3}\\.?\\d{3}-?\\d{2}$');
    expect(rule?.mask).toBe('000.000.000-00');
    expect(rule?.checksum).toBe('cpf-mod11');
  });

  it('reads phone rules per country from the bundled OAS', () => {
    expect.assertions(2);
    expect(phoneRuleFor('+55')?.pattern).toBe('^\\d{4,5}-?\\d{4}$');
    expect(phoneRuleFor('+1')?.pattern).toBe('^\\d{3}-?\\d{4}$');
  });

  it('masks CPF progressively as digits arrive', () => {
    expect.assertions(4);
    expect(maskCpf('1')).toBe('1');
    expect(maskCpf('12345')).toBe('123.45');
    expect(maskCpf('12345678909')).toBe('123.456.789-09');
    expect(maskCpf('123.456.789-09')).toBe('123.456.789-09');
  });

  it('masks SSN progressively', () => {
    expect.assertions(1);
    expect(maskSsn('123456789')).toBe('123-45-6789');
  });

  it('masks BR phone progressively', () => {
    expect.assertions(2);
    expect(maskPhone('+55', '998054033')).toBe('99805-4033');
    expect(maskPhone('+55', '9980540')).toBe('99805-40');
  });

  it('accepts a real CPF with valid verification digits', () => {
    expect.assertions(3);
    expect(isValidCpf('529.982.247-25')).toBe(true);
    expect(isValidCpf('123.456.789-09')).toBe(true);
    expect(isValidCpf('123.456.789-08')).toBe(false);
  });

  it('rejects repeated-digit CPFs', () => {
    expect.assertions(1);
    expect(isValidCpf('111.111.111-11')).toBe(false);
  });

  it('validateDocumentData blocks bad checksum before any HTTP', () => {
    expect.assertions(4);
    expect(validateDocumentData('CPF', 'BR', '123.456.789-08'))
      .toBe('CPF inválido — dígitos verificadores não conferem.');
    expect(validateDocumentData('CPF', 'BR', '123.456.789-09')).toBeNull();
    expect(validateDocumentData('CPF', 'BR', '12345678909')).toBeNull();
    expect(validateDocumentData('CPF', 'BR', '12345678908'))
      .toBe('CPF inválido — dígitos verificadores não conferem.');
  });

  it('validateDocumentData enforces the SSN pattern', () => {
    expect.assertions(3);
    expect(validateDocumentData('SSN', 'US', '123-45-6789')).toBeNull();
    expect(validateDocumentData('SSN', 'US', '123456789')).toBeNull();
    expect(validateDocumentData('SSN', 'US', '12-34-56789')).toContain('Formato inválido');
  });

  it('validateDocumentData requires a value', () => {
    expect.assertions(1);
    expect(validateDocumentData('CPF', 'BR', ' ')).toBe('Número do documento é obrigatório.');
  });

  it('validatePhone follows the country rule', () => {
    expect.assertions(3);
    expect(validatePhone('+55', '27', '99805-4033')).toBeNull();
    expect(validatePhone('+55', '27', '998054033')).toBeNull();
    expect(validatePhone('+1', '212', '555-0100')).toBeNull();
  });
});
