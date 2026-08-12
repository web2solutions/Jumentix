import type { CanaChangeEvent } from '@jumentix/cana';
import { applyCanaEventToRecords, connectCanaToPinia } from '../src';

type Categoria = {
  id: string;
  nome: string;
  cor: string;
};

const event = (overrides: Partial<CanaChangeEvent<Categoria>>): CanaChangeEvent<Categoria> => ({
  type: 'created',
  store: 'categorias',
  key: 'docs',
  record: { id: 'docs', nome: 'Documentacao', cor: '#2563eb' },
  cursor: 1,
  correlationId: 'corr-1',
  at: 1,
  originId: 'test',
  ...overrides
});

describe('applyCanaEventToRecords', () => {
  it('patches Vue/Pinia arrays from committed Cana events', () => {
    expect.hasAssertions();

    const created = applyCanaEventToRecords<Categoria>([], event({}), {
      store: 'categorias',
      getKey: (categoria) => categoria.id
    });
    const updated = applyCanaEventToRecords(created, event({
      type: 'updated',
      record: { id: 'docs', nome: 'Docs', cor: '#0f766e' }
    }), {
      store: 'categorias',
      getKey: (categoria) => categoria.id
    });

    expect(updated).toStrictEqual([{ id: 'docs', nome: 'Docs', cor: '#0f766e' }]);
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
