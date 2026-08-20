import type { CanaChangeEvent } from '@jumentix/cana';
import { applyCanaEventToRecords, connectCanaToPinia } from '../src';

type Category = {
  id: string;
  name: string;
  color: string;
};

const event = (overrides: Partial<CanaChangeEvent<Category>>): CanaChangeEvent<Category> => ({
  type: 'created',
  store: 'categories',
  key: 'docs',
  record: { id: 'docs', name: 'Documentation', color: '#2563eb' },
  cursor: 1,
  correlationId: 'corr-1',
  at: 1,
  originId: 'test',
  ...overrides
});

describe('applyCanaEventToRecords', () => {
  it('patches Vue/Pinia arrays from committed Cana events', () => {
    expect.hasAssertions();

    const created = applyCanaEventToRecords<Category>([], event({}), {
      store: 'categories',
      getKey: (category) => category.id
    });
    const updated = applyCanaEventToRecords(created, event({
      type: 'updated',
      record: { id: 'docs', name: 'Docs', color: '#0f766e' }
    }), {
      store: 'categories',
      getKey: (category) => category.id
    });

    expect(updated).toStrictEqual([{ id: 'docs', name: 'Docs', color: '#0f766e' }]);
  });
});

describe('connectCanaToPinia', () => {
  it('applies events and exposes the latest cursor', () => {
    expect.hasAssertions();

    let listener: ((entry: CanaChangeEvent) => void) | undefined;
    const client = {
      subscribe(next: (entry: CanaChangeEvent) => void) {
        listener = next;
        return () => undefined;
      }
    };
    const seen: CanaChangeEvent[] = [];

    const bridge = connectCanaToPinia({
      client: client as never,
      apply: (entry) => seen.push(entry)
    });

    listener?.(event({ cursor: 9 }));

    expect(seen).toHaveLength(1);
    expect(bridge.getLastCursor()).toBe(9);
  });
});
