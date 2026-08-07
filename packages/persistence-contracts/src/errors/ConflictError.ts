import { PersistenceError } from './PersistenceError';
import { PERSISTENCE_ERROR_CODES, PERSISTENCE_ERROR_NAMES } from './codes';

/** A unique constraint refused the write. The application maps this to 409. */
export class ConflictError extends PersistenceError {
  readonly code = PERSISTENCE_ERROR_CODES.conflict;

  readonly name = PERSISTENCE_ERROR_NAMES.conflict;
}
