import * as exceptions from '@src/infra/exceptions';
import { BaseError } from '@src/infra/exceptions/BaseError';
import { NotImplemented } from '@src/infra/exceptions/NotImplemented';

describe('infra exceptions', () => {
  it('instantiates all public custom exceptions', () => {
    expect.hasAssertions();

    // The three store errors are asserted separately below: they moved to
    // @jumentix/persistence-contracts under JUM-601 and no longer extend
    // BaseError, though they still serialize to the same shape.
    const targets = [
      exceptions.ComposeEventError,
      exceptions.DomainNotFoundError,
      exceptions.DomainValidationError,
      exceptions.ForbiddenError,
      exceptions.InternalServerError,
      exceptions.NotFoundError,
      NotImplemented,
      exceptions.ResourceLockedError,
      exceptions.UnauthorizedError,
      exceptions.ValidationError
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

    const storeErrors = [
      exceptions.ConflictError,
      exceptions.DataBaseNotFoundError,
      exceptions.DatabasePagingError
    ];

    for (const ExceptionCtor of storeErrors) {
      const error = new ExceptionCtor('boom');
      expect(error).toBeInstanceOf(Error);
      expect(error.toJSON()).toStrictEqual(expect.objectContaining({
        message: 'boom',
        code: expect.any(String),
        correlationId: expect.any(String)
      }));
      expect(error.name).toMatch(/^database_/);
    }
  });

  it('serializes BaseError with metadata and cause', () => {
    expect.hasAssertions();
    const error = new exceptions.ValidationError('invalid', new Error('cause'), { id: '1' });
    const serialized = error.toJSON();
    expect(serialized.message).toBe('invalid');
    expect(serialized.code).toBeDefined();
    expect(serialized.cause).toBeDefined();
    expect(serialized.metadata).toStrictEqual({ id: '1' });
  });
});
