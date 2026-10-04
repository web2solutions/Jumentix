import { PERSISTENCE_ERROR_CODES, PERSISTENCE_ERROR_NAMES } from './codes';
import PersistenceError from './PersistenceError';

/** A unique constraint refused the write. The application maps this to 409. */
class ConflictError extends PersistenceError {
  readonly code = PERSISTENCE_ERROR_CODES.conflict;

  readonly name = PERSISTENCE_ERROR_NAMES.conflict;
}

export default ConflictError;
