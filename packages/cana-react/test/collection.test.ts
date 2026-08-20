import type { CanaChangeEvent } from '@jumentix/cana';
import { applyCanaEventToRecords } from '../src';
import { connectCanaToRedux } from '../src/redux';

type Task = {
  id: string;
  title: string;
  categoryId: string;
  completed: boolean;
  updatedAt: number;
};

const event = (overrides: Partial<CanaChangeEvent<Task>>): CanaChangeEvent<Task> => ({
  type: 'created',
  store: 'tasks',
  key: 't1',
  record: {
    id: 't1',
    title: 'Escrever tutorial',
    categoryId: 'docs',
    completed: false,
    updatedAt: 1
  },
  cursor: 1,
  correlationId: 'corr-1',
  at: 1,
  originId: 'test',
  ...overrides
});

describe('applyCanaEventToRecords', () => {
  it('adds and replaces records from committed Cana events', () => {
    expect.hasAssertions();

    const created = applyCanaEventToRecords<Task>([], event({}), {
      store: 'tasks',
      getKey: (task) => task.id
    });
    const updated = applyCanaEventToRecords(created, event({
      type: 'updated',
      record: { ...created[0], title: 'Publish tutorial', updatedAt: 2 }
    }), {
      store: 'tasks',
      getKey: (task) => task.id
    });

    expect(updated).toHaveLength(1);
    expect(updated[0].title).toBe('Publish tutorial');
  });

  it('removes and clears records for delete events', () => {
    expect.hasAssertions();

    const records: Task[] = [
      {
        id: 't1',
        title: 'A',
        categoryId: 'docs',
        completed: false,
        updatedAt: 1
      },
      {
        id: 't2',
        title: 'B',
        categoryId: 'docs',
        completed: false,
        updatedAt: 2
      }
    ];

    expect(applyCanaEventToRecords(records, event({ type: 'deleted', key: 't1', record: undefined }), {
      store: 'tasks',
      getKey: (task) => task.id
    })).toStrictEqual([records[1]]);
    expect(applyCanaEventToRecords(records, event({ type: 'cleared', key: undefined, record: undefined }), {
      store: 'tasks'
    })).toStrictEqual([]);
  });
});

describe('connectCanaToRedux', () => {
  it('dispatches mapped actions and records the last cursor', () => {
    expect.hasAssertions();

    let listener: ((entry: CanaChangeEvent) => void) | undefined;
    const client = {
      subscribe(next: (entry: CanaChangeEvent) => void) {
        listener = next;
        return () => undefined;
      }
    };
    const actions: unknown[] = [];

    const bridge = connectCanaToRedux({
      client: client as never,
      dispatch: (action) => actions.push(action),
      mapEvent: (entry) => ({ type: 'cana/eventCommitted', payload: entry })
    });

    listener?.(event({ cursor: 7 }));

    expect(actions).toHaveLength(1);
    expect(bridge.getLastCursor()).toBe(7);
  });
});
