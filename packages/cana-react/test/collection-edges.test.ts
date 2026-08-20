import type { CanaChangeEvent } from '@jumentix/cana';
import { applyCanaEventToRecords } from '../src';

/**
 * Every way an event can reach a live collection (JUM-681).
 *
 * `applyCanaEventToRecords` is what keeps a rendered list in step with the
 * store without re-querying it, so each branch here is a way the screen can
 * quietly stop matching the data: an event for another store applied anyway, a
 * delete that misses because the key was read differently, a create that
 * duplicates a record already on screen, a `cleared` that leaves the list
 * standing.
 *
 * No doubles, no store: the function is pure, and these are its inputs.
 */
type Row = { id: string; name: string };

const event = (overrides: Partial<CanaChangeEvent>): CanaChangeEvent => ({
  type: 'created',
  store: 'rows',
  key: 'a',
  record: { id: 'a', name: 'A' },
  cursor: 1,
  correlationId: 'corr',
  at: 1,
  originId: 'test',
  ...overrides
} as CanaChangeEvent);

const options = { store: 'rows' };

describe('applyCanaEventToRecords (JUM-681)', () => {
  it('ignores an event from another store, without sharing the array', () => {
    expect.hasAssertions();

    const records: Row[] = [{ id: 'a', name: 'A' }];

    const next = applyCanaEventToRecords<Row>(records, event({ store: 'other' }), options);

    expect(next).toStrictEqual(records);
    // A returned reference to the caller's array turns a later push into a
    // mutation of state the framework believes it owns.
    expect(next).not.toBe(records);
  });

  it('empties the collection on a cleared store', () => {
    expect.hasAssertions();

    expect(applyCanaEventToRecords<Row>(
      [{ id: 'a', name: 'A' }],
      event({ type: 'cleared', record: undefined }),
      options
    )).toStrictEqual([]);
  });

  it('removes the deleted record by its default key', () => {
    expect.hasAssertions();

    expect(applyCanaEventToRecords<Row>(
      [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
      event({ type: 'deleted', key: 'a', record: undefined }),
      options
    )).toStrictEqual([{ id: 'b', name: 'B' }]);
  });

  it('removes the deleted record by a caller-supplied key', () => {
    expect.hasAssertions();

    // A store keyed on something other than `id` is ordinary, and a delete that
    // silently matches nothing leaves a deleted row on screen.
    type Keyed = { ref: string; name: string };
    const records: Keyed[] = [{ ref: 'a', name: 'A' }, { ref: 'b', name: 'B' }];

    expect(applyCanaEventToRecords<Keyed>(
      records,
      event({ type: 'deleted', key: 'b', record: undefined }),
      { store: 'rows', getKey: (row) => row.ref }
    )).toStrictEqual([{ ref: 'a', name: 'A' }]);
  });

  it('keeps records whose key cannot be read', () => {
    expect.hasAssertions();

    // Primitives and objects without `id` have no default key. Treating
    // "unknown" as "matches" would delete the whole list on one event.
    const records = ['a', 'b'] as unknown as Row[];

    expect(applyCanaEventToRecords<Row>(
      records,
      event({ type: 'deleted', key: 'a', record: undefined }),
      options
    )).toStrictEqual(['a', 'b']);
  });

  it('leaves the collection alone when a write event carries no record', () => {
    expect.hasAssertions();

    // A committed write with no payload — a projection the subscriber did not
    // ask for — must not append `undefined` to a rendered list.
    const records: Row[] = [{ id: 'a', name: 'A' }];

    expect(applyCanaEventToRecords<Row>(records, event({ record: undefined }), options))
      .toStrictEqual(records);
  });

  it('replaces the record it already holds rather than duplicating it', () => {
    expect.hasAssertions();

    expect(applyCanaEventToRecords<Row>(
      [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
      event({ type: 'updated', key: 'a', record: { id: 'a', name: 'A2' } }),
      options
    )).toStrictEqual([{ id: 'b', name: 'B' }, { id: 'a', name: 'A2' }]);
  });

  it('re-sorts when the collection is ordered', () => {
    expect.hasAssertions();

    // Without the sort the new record lands at the end, which is a list that
    // claims to be ordered and is not.
    expect(applyCanaEventToRecords<Row>(
      [{ id: 'b', name: 'B' }, { id: 'c', name: 'C' }],
      event({ record: { id: 'a', name: 'A' } }),
      { store: 'rows', sort: (left, right) => left.id.localeCompare(right.id) }
    ).map((row) => row.id)).toStrictEqual(['a', 'b', 'c']);
  });

  it('matches Date keys by their instant, not by identity', () => {
    expect.hasAssertions();

    // IndexedDB allows Date keys, and two Dates for the same instant are never
    // `===`. Compared by identity, an update appends a second copy.
    type Dated = { at: Date; name: string };
    const records: Dated[] = [{ at: new Date(10), name: 'first' }];

    const next = applyCanaEventToRecords<Dated>(
      records,
      event({ type: 'updated', record: { at: new Date(10), name: 'second' } }),
      { store: 'rows', getKey: (row) => row.at }
    );

    expect(next).toHaveLength(1);
    expect(next[0].name).toBe('second');
  });

  it('keeps records whose Date key is a different instant', () => {
    expect.hasAssertions();

    type Dated = { at: Date; name: string };

    expect(applyCanaEventToRecords<Dated>(
      [{ at: new Date(10), name: 'first' }],
      event({ type: 'updated', record: { at: new Date(20), name: 'second' } }),
      { store: 'rows', getKey: (row) => row.at }
    )).toHaveLength(2);
  });
});
