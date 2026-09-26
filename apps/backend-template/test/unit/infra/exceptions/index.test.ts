import { Context } from '@src/infra/context/Context';
import {
  ComposeEventError,
  ConflictError,
  DataBaseNotFoundError,
  DatabasePagingError,
  DomainNotFoundError,
  DomainValidationError,
  ForbiddenError,
  InternalServerError,
  NotFoundError,
  ResourceLockedError,
  UnauthorizedError,
  ValidationError
} from '@src/infra/exceptions';
import BaseError from '@src/infra/exceptions/BaseError';
import NotImplemented from '@src/infra/exceptions/NotImplemented';

describe('infra exceptions', () => {
  it('instantiates all public custom exceptions', () => {
    expect.hasAssertions();

    // The three store errors are asserted separately below: they moved to
    // @jumentix/persistence-contracts under JUM-601 and no longer extend
    // BaseError, though they still serialize to the same shape.
    const targets = [
      ComposeEventError,
      DomainNotFoundError,
      DomainValidationError,
      ForbiddenError,
      InternalServerError,
      NotFoundError,
      NotImplemented,
      ResourceLockedError,
      UnauthorizedError,
      ValidationError
    ];

    for (const ExceptionCtor of targets) {
      const error = new ExceptionCtor('boom');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(BaseError);
      expect(error.toJSON()).toStrictEqual(expect.objectContaining({ message: 'boom' }));
    }
  });

  /**
   * The store errors, which live in `@jumentix/persistence-contracts` now
   * (JUM-601) so a library stops importing this application.
   *
   * They are still exported from here, still carry the same `name` and `code`
   * that `formatErrorMessage` and `toHttpStatus` branch on, and still serialize
   * with the fields `shared/utils.ts` puts in an error response. What they no
   * longer share is the `BaseError` implementation — the class identity was
   * never the contract, because nothing in this application uses `instanceof`
   * on them.
   */
  it('keeps the serialized contract for the store errors that moved out', () => {
    expect.hasAssertions();

    const storeErrors = [ConflictError, DataBaseNotFoundError, DatabasePagingError];

    for (const ExceptionCtor of storeErrors) {
      const error = new ExceptionCtor('boom');
      expect(error).toBeInstanceOf(Error);
      expect(error.toJSON()).toStrictEqual(
        expect.objectContaining({
          message: 'boom',
          code: expect.any(String),
          correlationId: expect.any(String)
        })
      );
      expect(error.name).toMatch(/^database_/);
    }
  });

  it('registers persistence-contract errors against the application correlation context', () => {
    expect.hasAssertions();

    Context.run(new Map([['correlationId', 'corr-db-1']]), () => {
      expect(new ConflictError('boom').correlationId).toBe('corr-db-1');
    });
    Context.run(new Map([['correlationId', null]]), () => {
      expect(new DataBaseNotFoundError('boom').correlationId).toBe('');
    });
    expect(new DatabasePagingError('boom').correlationId).toBe('');
  });

  it('serializes BaseError with metadata and cause', () => {
    expect.hasAssertions();
    const error = new ValidationError('invalid', new Error('cause'), { id: '1' });
    const serialized = error.toJSON();
    expect(serialized.message).toBe('invalid');
    expect(typeof serialized.code).toBe('string');
    expect(serialized.cause).toBeDefined();
    expect(serialized.metadata).toStrictEqual({ id: '1' });
  });
});
