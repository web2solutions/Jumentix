import { BaseDomainEvent } from '@src/modules/port/BaseDomainEvent';
import { readListCapabilities, setListQuery } from '@src/modules/port/setListQuery';
import { ValidationError } from '@src/infra/exceptions';
import { _DEFAULT_PAGE_SIZE_ } from '@src/config/constants';

class TestEvent extends BaseDomainEvent<any> {}

const capabilities = {
  sortable: ['firstName', 'createdAt'],
  filterable: { firstName: 'text', roles: 'enum', createdAt: 'date' },
  searchable: ['firstName', 'lastName'],
  defaultSize: 20,
  maxSize: 50
};

const b64 = (value: unknown): string => Buffer.from(JSON.stringify(value)).toString('base64');

const event = (
  queryString: Record<string, unknown>,
  schemaOAS: Record<string, unknown> | undefined = { 'x-list-capabilities': capabilities }
) => new TestEvent({ queryString, schemaOAS });

/**
 * JUM-777 — `x-list-capabilities` is the single source of what a client may
 * sort, filter and search by. These tests prove the server rejects anything
 * outside it with the accepted list in the message, and that operations
 * without the extension keep the legacy paging behaviour.
 */
describe('setListQuery', () => {
  it('reads the capabilities declared by the operation', () => {
    expect.hasAssertions();
    expect(readListCapabilities({ 'x-list-capabilities': capabilities })).toStrictEqual(capabilities);
    expect(readListCapabilities({})).toBeUndefined();
    expect(readListCapabilities({ 'x-list-capabilities': { sortable: ['a'] } })).toStrictEqual({
      sortable: ['a'], filterable: {}, searchable: [], defaultSize: 30, maxSize: 100
    });
  });

  it('parses page, size, filter, sort and q into filters + paging', () => {
    expect.hasAssertions();
    const { filters, paging } = setListQuery(event({
      page: '2',
      size: '10',
      filter: b64({ firstName: { operator: 'contains', value: 'an' }, roles: 'admin' }),
      sort: 'createdAt:desc,firstName',
      q: '  Ana '
    }));
    expect(filters).toStrictEqual({ firstName: { operator: 'contains', value: 'an' }, roles: 'admin' });
    expect(paging).toStrictEqual({
      page: 2,
      size: 10,
      sort: [{ field: 'createdAt', direction: 'desc' }, { field: 'firstName', direction: 'asc' }],
      q: 'Ana',
      searchFields: ['firstName', 'lastName']
    });
  });

  it('uses the declared defaultSize and falls back to the app default without capabilities', () => {
    expect.hasAssertions();
    expect(setListQuery(event({})).paging).toStrictEqual({ page: 1, size: 20 });
    expect(setListQuery(event({}, {})).paging)
      .toStrictEqual({ page: 1, size: _DEFAULT_PAGE_SIZE_ });
  });

  it('rejects sizes above maxSize naming the bound', () => {
    expect.hasAssertions();
    expect(() => setListQuery(event({ size: '51' }))).toThrow(ValidationError);
    expect(() => setListQuery(event({ size: '51' }))).toThrow('between 1 and 50; received 51');
  });

  it('rejects sort fields, filter fields and operators outside the capabilities, listing what is accepted', () => {
    expect.hasAssertions();
    expect(() => setListQuery(event({ sort: 'username:asc' })))
      .toThrow('The sort field "username" is not sortable. Accepted: firstName, createdAt.');
    expect(() => setListQuery(event({ filter: b64({ username: 'x' }) })))
      .toThrow('The filter field "username" is not filterable. Accepted: firstName, roles, createdAt.');
    expect(() => setListQuery(event({ filter: b64({ firstName: { operator: 'regex', value: '.*' } }) })))
      .toThrow('The filter operator "regex" on "firstName" is not accepted.');
  });

  it('rejects q when nothing is searchable, and sort/q entirely for legacy operations', () => {
    expect.hasAssertions();
    const unsearchable = { 'x-list-capabilities': { ...capabilities, searchable: [] } };
    expect(() => setListQuery(event({ q: 'x' }, unsearchable))).toThrow('declares no searchable fields');
    expect(() => setListQuery(event({ q: 'x' }, {}))).toThrow('not supported by this operation');
    expect(() => setListQuery(event({ sort: 'a' }, {}))).toThrow('not supported by this operation');
    expect(setListQuery(event({ filter: b64({ anything: 1 }) }, {})).filters)
      .toStrictEqual({ anything: 1 });
  });

  it('parses includeDeleted flags and tolerates a missing queryString', () => {
    expect.hasAssertions();
    expect(setListQuery(event({ includeDeleted: 'true' })).paging.includeDeleted).toBe(true);
    expect(setListQuery(event({ includeDeleted: '1' })).paging.includeDeleted).toBe(true);
    expect(setListQuery(event({ includeDeleted: '0' })).paging.includeDeleted).toBe(false);
    const noQuery = new TestEvent({ schemaOAS: { 'x-list-capabilities': capabilities } });
    (noQuery as any).queryString = undefined;
    expect(setListQuery(noQuery).paging).toStrictEqual({ page: 1, size: 20 });
  });

  it('treats a non-array sortable declaration as empty and names "(none)" as accepted', () => {
    expect.hasAssertions();
    expect(readListCapabilities({ 'x-list-capabilities': { sortable: 'firstName' } }))
      .toStrictEqual({
        sortable: [], filterable: {}, searchable: [], defaultSize: 30, maxSize: 100
      });
    const unsortable = { 'x-list-capabilities': { ...capabilities, sortable: [] } };
    expect(() => setListQuery(event({ sort: 'username:asc' }, unsortable)))
      .toThrow('The sort field "username" is not sortable. Accepted: (none).');
  });

  it('rejects filter objects that omit the operator', () => {
    expect.hasAssertions();
    expect(() => setListQuery(event({ filter: b64({ firstName: { value: 'an' } }) })))
      .toThrow('The filter operator "" on "firstName" is not accepted.');
  });
});
