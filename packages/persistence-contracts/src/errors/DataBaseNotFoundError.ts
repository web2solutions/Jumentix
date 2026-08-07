import { PersistenceError } from './PersistenceError';
import { PERSISTENCE_ERROR_CODES, PERSISTENCE_ERROR_NAMES } from './codes';

/** The record the caller asked for does not exist. Maps to 404. */
export class DataBaseNotFoundError extends PersistenceError {
  readonly code = PERSISTENCE_ERROR_CODES.notFound;

  readonly name = PERSISTENCE_ERROR_NAMES.notFound;
}
