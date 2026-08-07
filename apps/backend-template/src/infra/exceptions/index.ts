// Side-effect import: registers this application's correlation id source
// with the store errors that now live in @jumentix/persistence-contracts
// (JUM-601). Must run before any of them is constructed.
import './registerPersistenceCorrelation';

export * from './BaseError';
export * from './error.codes';
export * from './ComposeEventError';
export * from './ConflictError';
export * from './DataBaseNotFoundError';
export * from './DatabasePagingError';
export * from './DomainNotFoundError';
export * from './DomainValidationError';
export * from './ForbiddenError';
export * from './InternalServerError';
export * from './NotFoundError';
export * from './ResourceLockedError';
export * from './UnauthorizedError';
export * from './ValidationError';
export * from './ISerializedError';
