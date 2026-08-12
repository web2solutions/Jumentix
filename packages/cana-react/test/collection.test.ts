import type { CanaChangeEvent } from '@jumentix/cana';
import { applyCanaEventToRecords } from '../src';
import { connectCanaToRedux } from '../src/redux';

type Tarefa = {
  id: string;
  titulo: string;
  categoriaId: string;
  concluida: boolean;
  atualizadaEm: number;
};

const event = (overrides: Partial<CanaChangeEvent<Tarefa>>): CanaChangeEvent<Tarefa> => ({
  type: 'created',
  store: 'tarefas',
  key: 't1',
  record: {
    id: 't1',
    titulo: 'Escrever tutorial',
    categoriaId: 'docs',
    concluida: false,
    atualizadaEm: 1
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

    const created = applyCanaEventToRecords<Tarefa>([], event({}), {
      store: 'tarefas',
      getKey: (tarefa) => tarefa.id
    });
    const updated = applyCanaEventToRecords(created, event({
      type: 'updated',
      record: { ...created[0], titulo: 'Publicar tutorial', atualizadaEm: 2 }
    }), {
      store: 'tarefas',
      getKey: (tarefa) => tarefa.id
    });

    expect(updated).toHaveLength(1);
    expect(updated[0].titulo).toBe('Publicar tutorial');
  });

  it('removes and clears records for delete events', () => {
    expect.hasAssertions();

    const records: Tarefa[] = [
      {
        id: 't1',
        titulo: 'A',
        categoriaId: 'docs',
        concluida: false,
        atualizadaEm: 1
      },
      {
        id: 't2',
        titulo: 'B',
        categoriaId: 'docs',
        concluida: false,
        atualizadaEm: 2
      }
    ];

    expect(applyCanaEventToRecords(records, event({ type: 'deleted', key: 't1', record: undefined }), {
      store: 'tarefas',
      getKey: (tarefa) => tarefa.id
    })).toStrictEqual([records[1]]);
    expect(applyCanaEventToRecords(records, event({ type: 'cleared', key: undefined, record: undefined }), {
      store: 'tarefas'
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
