import { PersistenceError } from './PersistenceError';
import { PERSISTENCE_ERROR_CODES, PERSISTENCE_ERROR_NAMES } from './codes';

/**
 * The paging arguments do not describe a page that could exist.
 *
 * Maps to 400 rather than 404: asking for page zero is a malformed request,
 * not a missing resource.
 */
export class DatabasePagingError extends PersistenceError {
  readonly code = PERSISTENCE_ERROR_CODES.invalidInput;

  readonly name = PERSISTENCE_ERROR_NAMES.paging;
}
