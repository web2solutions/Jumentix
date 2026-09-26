import { PERSISTENCE_ERROR_CODES, PERSISTENCE_ERROR_NAMES } from './codes';
import PersistenceError from './PersistenceError';

/** The record the caller asked for does not exist. Maps to 404. */
class DataBaseNotFoundError extends PersistenceError {
  readonly code = PERSISTENCE_ERROR_CODES.notFound;

  readonly name = PERSISTENCE_ERROR_NAMES.notFound;
}

export default DataBaseNotFoundError;
