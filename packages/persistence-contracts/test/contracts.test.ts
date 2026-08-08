import * as contracts from '../src';
import {
  ConflictError,
  DataBaseNotFoundError,
  DatabasePagingError,
  PERSISTENCE_ERROR_CODES,
  PERSISTENCE_ERROR_NAMES,
  currentCorrelationId,
  setCorrelationIdResolver
} from '../src';
import type {
  IDatabaseClient,
  IStore,
  IStoreQuery,
  IStoreSortField,
  IStoreTransaction,
  TStoreFilters
} from '../src';

/**
 * Requirement 112 — this package owns its suite.
 *
 * It is an unusual one, because the package is almost entirely types. Two of
 * its three files compile to an empty module: no test can execute a line of
 * them, and no coverage report will ever mention them. Only the barrel emits
 * anything, and only because `export *` becomes a `require`.
 *
 * So the runtime part of this file is small and says one thing: this package
 * exports no values. The rest are compile-time assertions, and they are the
 * ones that matter. Every store adapter in the repository — Mongo, SQL, Dynamo,
 * Cassandra, Firebase, Oracle, and cana in the browser — is checked against
 * `IStore`. If an optional method quietly became required, or a filter stopped
 * being restricted to the keys of the entity, every one of those adapters
 * breaks at once, and nothing here would have said so.
 *
 * `@ts-expect-error` is the mechanism: it fails the build when the error it
 * marks does *not* happen, so each one below is an assertion that the contract
 * still rejects what it is supposed to reject. Jest typechecks this file
 * (Requirement 110); bun does not, which is why the runtime assertions exist
 * alongside them.
 */

interface User {
  id: string;
  name: string;
  age: number;
}

describe('the package entry point', () => {
  /**
   * The runtime surface, pinned exactly.
   *
   * This used to assert the package exported *nothing* at runtime, guarding a
   * package the rest of the repository treats as free to import anywhere,
   * including a browser bundle. JUM-601 added the three store errors, which are
   * values — so the guard is now the precise list rather than an empty one. It
   * still fails the moment a fourth thing appears.
   *
   * The cost was measured rather than assumed: the compiled module is 1.1 kB
   * and tree-shakeable, and no browser package imports this one today.
   */
  it('exports exactly the store errors at runtime, and nothing else', () => {
    expect.hasAssertions();

    expect(Object.keys(contracts).sort()).toStrictEqual([
      'ConflictError',
      'DataBaseNotFoundError',
      'DatabasePagingError',
      'PERSISTENCE_ERROR_CODES',
      'PERSISTENCE_ERROR_NAMES',
      'PersistenceError',
      'currentCorrelationId',
      'setCorrelationIdResolver'
    ]);
  });
});

describe('the store contract', () => {
  /**
   * The six methods every adapter must provide. This is the shape the repository
   * actually relies on; the rest of `IStore` is optional capability.
   */
  it('is satisfiable with only the required methods', () => {
    expect.hasAssertions();

    const minimal: IStore<User> = {
      delete: async () => true,
      getOneById: async () => ({ id: '1', name: 'a', age: 1 }),
      create: async (_key, value) => value,
      update: async (_key, value) => value,
      getAll: async () => ({ total: 0, data: [] })
    };

    expect(typeof minimal.getOneById).toBe('function');
  });

  it('rejects an implementation missing a required method', () => {
    expect.hasAssertions();

    // @ts-expect-error `getAll` is required, and leaving it out must not compile.
    const incomplete: IStore<User> = {
      delete: async () => true,
      getOneById: async () => ({ id: '1', name: 'a', age: 1 }),
      create: async (_key, value) => value,
      update: async (_key, value) => value
    };

    expect(incomplete).toBeDefined();
  });

  it('accepts the optional capabilities when an adapter provides them', () => {
    expect.hasAssertions();

    const capable: IStore<User> = {
      delete: async () => true,
      getOneById: async () => ({ id: '1', name: 'a', age: 1 }),
      create: async (_key, value) => value,
      update: async (_key, value) => value,
      getAll: async () => ({ total: 0 }),
      count: async () => 0,
      exists: async () => false,
      findOne: async () => null,
      beginTransaction: async () => ({
        id: 't1',
        commit: async () => {},
        rollback: async () => {}
      })
    };

    expect(typeof capable.beginTransaction).toBe('function');
  });
});

describe('queries', () => {
  /**
   * A filter naming a field the entity does not have is a typo that would
   * otherwise reach the database and silently match nothing.
   */
  it('restricts filters to the keys of the entity', () => {
    expect.hasAssertions();

    const valid: TStoreFilters<User> = { name: 'a', age: { operator: 'gte', value: 18 } };

    expect(valid.name).toBe('a');
  });

  it('rejects a filter on a field the entity does not have', () => {
    expect.hasAssertions();

    // @ts-expect-error `nickname` is not a key of User.
    const invalid: TStoreFilters<User> = { nickname: 'a' };

    expect(invalid).toBeDefined();
  });

  it('restricts sorting to the keys of the entity', () => {
    expect.hasAssertions();

    const sort: IStoreSortField<User> = { field: 'age', direction: 'desc', nulls: 'last' };

    expect(sort.field).toBe('age');
  });

  it('rejects sorting on a field the entity does not have', () => {
    expect.hasAssertions();

    // @ts-expect-error `nickname` is not a key of User.
    const sort: IStoreSortField<User> = { field: 'nickname' };

    expect(sort).toBeDefined();
  });

  it('rejects a sort direction it does not define', () => {
    expect.hasAssertions();

    // @ts-expect-error only 'asc' and 'desc' exist.
    const sort: IStoreSortField<User> = { field: 'age', direction: 'sideways' };

    expect(sort).toBeDefined();
  });

  /**
   * The operator list is enforced (JUM-599).
   *
   * This test used to assert the opposite. `TStoreScalar`'s object arm was a
   * bare `Record<string, unknown>`, so every object satisfied it — a filter
   * expression matched on the scalar arm, `TFilterOperator` was never
   * consulted, and an invented operator compiled. `operator?: never` on that
   * arm keeps the two disjoint: an object carrying `operator` can only be an
   * `IStoreFilterExpression`, where the list is checked.
   */
  it('rejects an operator that is not on the list', () => {
    expect.hasAssertions();

    const query: IStoreQuery<User> = { filters: { age: { operator: 'gte', value: 18 } } };

    // @ts-expect-error 'approximately' is not a TFilterOperator.
    const invented: IStoreQuery<User> = { filters: { age: { operator: 'approximately' } } };

    expect(query.filters?.age).toStrictEqual({ operator: 'gte', value: 18 });
    expect(invented.filters?.age).toStrictEqual({ operator: 'approximately' });
  });

  /**
   * The narrowing must not cost the cases that were always legitimate: a bare
   * value, and a nested document. Both are objects, and a rule written to
   * exclude objects wholesale would have broken them.
   */
  it('still accepts a bare value and a nested document as filters', () => {
    expect.hasAssertions();

    const bare: IStoreQuery<User> = { filters: { age: 18 } };
    const nested: IStoreQuery<User> = { filters: { name: { first: 'ada' } } };

    expect(bare.filters?.age).toBe(18);
    expect(nested.filters?.name).toStrictEqual({ first: 'ada' });
  });

  it('allows a query with nothing in it', () => {
    expect.hasAssertions();

    // Every field is optional: `find()` with no criteria means everything.
    const query: IStoreQuery<User> = {};

    expect(query).toStrictEqual({});
  });
});

describe('the transaction contract', () => {
  it('requires both a commit and a rollback', () => {
    expect.hasAssertions();

    // @ts-expect-error a transaction that can only commit cannot be rolled back.
    const halfway: IStoreTransaction = { id: 't1', commit: async () => {} };

    expect(halfway).toBeDefined();
  });
});

describe('the database client contract', () => {
  it('is satisfiable by a client holding named stores', () => {
    expect.hasAssertions();

    const users: IStore<User> = {
      delete: async () => true,
      getOneById: async () => ({ id: '1', name: 'a', age: 1 }),
      create: async (_key, value) => value,
      update: async (_key, value) => value,
      getAll: async () => ({ total: 0 })
    };

    const client: IDatabaseClient<{ users: IStore<User> }> = {
      connect: async () => {},
      disconnect: async () => {},
      stores: { users }
    };

    expect(Object.keys(client.stores)).toStrictEqual(['users']);
  });

  it('rejects a client that cannot be disconnected', () => {
    expect.hasAssertions();

    // @ts-expect-error `disconnect` is required — a client that cannot be closed
    // leaks a connection for the life of the process.
    const client: IDatabaseClient = { connect: async () => {}, stores: {} };

    expect(client).toBeDefined();
  });
});

/**
 * The store errors (JUM-601).
 *
 * They moved here from `apps/backend-template/src/infra/exceptions` because
 * `external-store-proxy` throws them and a library must not import from an
 * application. The contract that survived the move is entirely in the strings:
 * the application recognises these by `error.name` and maps `code` to an HTTP
 * status, so a drift in either would route an error to the wrong response with
 * nothing failing.
 */
describe('the store errors', () => {
  it.each([
    [ConflictError, 'database_duplicated', 'GENERIC.CONFLICT'],
    [DataBaseNotFoundError, 'database_not_found', 'GENERIC.NOT_FOUND'],
    [DatabasePagingError, 'database_paging_error', 'GENERIC.INVALID_INPUT']
  ])('%p carries the name and code the application matches on', (
    ErrorClass: new (message: string) => Error & { code: string },
    name: string,
    code: string
  ) => {
    expect.hasAssertions();

    const error = new ErrorClass('something went wrong');

    expect(error.name).toBe(name);
    expect(error.code).toBe(code);
  });

  it('is a real Error, so it can be thrown and caught as one', () => {
    expect.hasAssertions();

    expect(() => {
      throw new ConflictError('email already in use');
    }).toThrow('email already in use');
    expect(new ConflictError('x')).toBeInstanceOf(Error);
  });

  /**
   * The stack must start where the throw was, not inside the constructor.
   * `captureStackTrace` is the only reason that holds, and it is optional on
   * some runtimes — hence the guarded call in the source.
   */
  it('starts its stack at the line that threw', () => {
    expect.hasAssertions();

    const error = new DataBaseNotFoundError('Record not found');

    expect(error.stack).toBeDefined();
    expect(error.stack).not.toMatch(/at new (DataBaseNotFoundError|PersistenceError)/);
  });

  it('carries a cause and metadata through when given them', () => {
    expect.hasAssertions();

    const cause = new Error('unique constraint violated');
    const error = new ConflictError('email already in use', cause, { field: 'email' });

    expect(error.cause).toBe(cause);
    expect(error.metadata).toStrictEqual({ field: 'email' });
  });

  it('exposes the name and code tables it is built from', () => {
    expect.hasAssertions();

    expect(PERSISTENCE_ERROR_NAMES.conflict).toBe('database_duplicated');
    expect(PERSISTENCE_ERROR_CODES.invalidInput).toBe('GENERIC.INVALID_INPUT');
  });
});

/**
 * The correlation-id seam (JUM-601).
 *
 * The application stamps an id per request and `shared/utils.ts` puts it in
 * every error response. These errors are thrown inside a library, so without a
 * way back to that id every database error would have lost it — which is why
 * the move needed an inversion rather than a relocation.
 */
describe('the correlation id resolver', () => {
  it('is empty until an application registers one', () => {
    expect.hasAssertions();

    expect(new ConflictError('x').correlationId).toBe('');
  });

  it('uses the registered resolver, and hands back the previous one', () => {
    expect.hasAssertions();

    const previous = setCorrelationIdResolver(() => 'req-42');

    try {
      expect(new DataBaseNotFoundError('x').correlationId).toBe('req-42');
      expect(new ConflictError('x').toJSON().correlationId).toBe('req-42');
    } finally {
      // Returned so a test can restore it rather than leaking a stub into the
      // suites that follow.
      setCorrelationIdResolver(previous);
    }

    expect(new ConflictError('x').correlationId).toBe('');
  });

  /**
   * An error being constructed must not be derailed by the thing annotating
   * it. A throwing resolver would otherwise replace the real failure with its
   * own, which is the worst possible substitution.
   */
  it('falls back to empty when the resolver throws', () => {
    expect.hasAssertions();

    const previous = setCorrelationIdResolver(() => {
      throw new Error('no context');
    });

    try {
      expect(new ConflictError('x').correlationId).toBe('');
    } finally {
      setCorrelationIdResolver(previous);
    }
  });

  it('ignores a resolver that is not a function', () => {
    expect.hasAssertions();

    const previous = setCorrelationIdResolver(undefined as never);

    try {
      expect(currentCorrelationId()).toBe('');
    } finally {
      setCorrelationIdResolver(previous);
    }
  });

  it('serializes the cause as a string, so it survives JSON', () => {
    expect.hasAssertions();

    const error = new ConflictError('dup', new Error('unique violated'), { field: 'email' });
    const serialized = error.toJSON();

    expect(serialized.cause).toBe(JSON.stringify(new Error('unique violated')));
    expect(serialized.metadata).toStrictEqual({ field: 'email' });
    expect(serialized.stack).toBeDefined();
  });
});
