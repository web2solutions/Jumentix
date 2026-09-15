import {
  afterEach, describe, expect, it
} from 'bun:test';

import { getOperationForEntity, resolveSchema } from '@/contracts/formSchema';
import { toQueryParams } from '@/contracts/listSchema';
import { validateField } from '@/contracts/oasForm';

/** Contract engine guards (JUM-766/777): unknown entities, base64 fallback, email format. */
describe('contract engine guards', () => {
  afterEach(() => {
    if (typeof globalThis.btoa !== 'function') {
      globalThis.btoa = (value: string) => Buffer.from(value, 'binary').toString('base64');
    }
  });

  it('returns undefined when the entity has no GET-by-id operation', () => {
    expect.hasAssertions();
    expect(getOperationForEntity('NoSuchEntity')).toBeUndefined();
  });

  it('fails loudly when the schema is not declared in the bundled OAS', () => {
    expect.hasAssertions();
    expect(() => resolveSchema('NoSuchSchema')).toThrow('formSchema: schema "NoSuchSchema" not declared in the bundled OAS');
  });

  it('encodes filters as base64 JSON even without btoa', () => {
    expect.hasAssertions();
    const originalBtoa = globalThis.btoa;
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete (globalThis as Record<string, unknown>).btoa;
    try {
      const params = toQueryParams({ page: 1, size: 30, filter: { organization: 'org-1' } });
      const decoded = JSON.parse(Buffer.from(String(params.filter), 'base64').toString('utf8'));
      expect(decoded).toStrictEqual({ organization: 'org-1' });
    } finally {
      globalThis.btoa = originalBtoa;
    }
  });

  it('rejects malformed values on email-format fields', () => {
    expect.hasAssertions();
    expect(validateField({
      name: 'contact', type: 'string', format: 'email', required: false
    }, 'not-an-email')).not.toBeNull();
    expect(validateField({
      name: 'contact', type: 'string', format: 'email', required: false
    }, 'person@x.dev')).toBeNull();
  });
});
