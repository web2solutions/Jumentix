// Side-effect import: registers this application's correlation id source
// with the store errors that now live in @jumentix/persistence-contracts
// (JUM-601). Must run before any of them is constructed.
import './registerPersistenceCorrelation';

export { default as BaseError } from './BaseError';
export * from './error.codes';
export { default as ComposeEventError } from './ComposeEventError';
export { default as ConflictError } from './ConflictError';
export { default as DataBaseNotFoundError } from './DataBaseNotFoundError';
export { default as DatabasePagingError } from './DatabasePagingError';
export { default as DomainNotFoundError } from './DomainNotFoundError';
export { default as DomainValidationError } from './DomainValidationError';
export { default as ForbiddenError } from './ForbiddenError';
export { default as InternalServerError } from './InternalServerError';
export { default as NotFoundError } from './NotFoundError';
export { default as ResourceLockedError } from './ResourceLockedError';
export { default as UnauthorizedError } from './UnauthorizedError';
export { default as ValidationError } from './ValidationError';
export * from './ISerializedError';
