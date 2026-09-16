import { describe, expect, it } from 'bun:test';

import { fieldDescriptors } from '@/contracts/formSchema';
import {
  documentInputCap,
  filterDocumentData,
  patternAlphabet,
  patternCap
} from '@/contracts/validation';

/**
 * JUM-769: pattern-only x-validation rules (passport, RG) must enforce
 * alphabet + cap at the input, not just at save time. All expectations are
 * derived from the OAS `x-validation` blocks — nothing is hardcoded here
 * beyond what the spec declares.
 */
describe('pattern-only OAS rules enforced at input level (JUM-769)', () => {
  it('extracts the alphabet from anchored class patterns', () => {
    expect.assertions(4);
    expect(patternAlphabet('^[A-Za-z0-9]{5,20}$')).toBe('A-Za-z0-9');
    expect(patternAlphabet('^[A-Za-z0-9.-]{4,20}$')).toBe('A-Za-z0-9.-');
    expect(patternAlphabet('^\\d{3}-?\\d{2}-?\\d{4}$')).toBeUndefined(); // mask-handled shape
    expect(patternAlphabet(undefined)).toBeUndefined();
  });

  it('extracts the cap from the pattern quantifier', () => {
    expect.assertions(4);
    expect(patternCap('^[A-Za-z0-9]{5,20}$')).toBe(20);
    expect(patternCap('^[A-Za-z0-9.-]{4,20}$')).toBe(20);
    expect(patternCap('^[A-Z]{2}$')).toBe(2);
    expect(patternCap('^[A-Za-z0-9]{5,}$')).toBeUndefined(); // unbounded
  });

  it('passport strips characters outside the OAS alphabet and caps at 20', () => {
    expect.assertions(3);
    expect(filterDocumentData('passport', 'BR', 'abc123xyz!!!999888777')).toBe('abc123xyz999888777');
    expect(filterDocumentData('passport', 'BR', 'AB 123-456')).toBe('AB123456');
    expect(filterDocumentData('passport', 'BR', 'A'.repeat(25))).toBe('A'.repeat(20));
  });

  it('RG keeps dots and dashes declared in the OAS alphabet', () => {
    expect.assertions(2);
    expect(filterDocumentData('RG', 'BR', '12.345.678-9')).toBe('12.345.678-9');
    expect(filterDocumentData('RG', 'BR', '12!345@678#')).toBe('12345678');
  });

  it('CPF/SSN keep their masks untouched (regression)', () => {
    expect.assertions(2);
    expect(filterDocumentData('CPF', 'BR', '52998224725')).toBe('529.982.247-25');
    expect(filterDocumentData('SSN', 'US', '123456789')).toBe('123-45-6789');
  });

  it('documentInputCap comes from the mask or the pattern upper bound', () => {
    expect.assertions(4);
    expect(documentInputCap('CPF', 'BR')).toBe(14); // mask length
    expect(documentInputCap('SSN', 'US')).toBe(11);
    expect(documentInputCap('passport', 'BR')).toBe(20); // pattern {5,20}
    expect(documentInputCap('RG', 'BR')).toBe(20);
  });

  it('Document.data declares maxLength 20 in the bundled OAS', () => {
    expect.assertions(3);
    const create = fieldDescriptors('RequestCreateDocument').find((d) => d.name === 'data')!;
    const update = fieldDescriptors('RequestUpdateDocument').find((d) => d.name === 'data')!;
    expect(create.maxLength).toBe(20);
    expect(update.maxLength).toBe(20);
    expect(filterDocumentData('unknown-type', 'BR', 'free form !')).toBe('free form !'); // no rule: free-form per OAS
  });
});
