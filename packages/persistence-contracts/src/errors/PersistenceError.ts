import { currentCorrelationId } from './correlation';

/**
 * The base for errors a store adapter raises (JUM-601).
 *
 * These live in this package because `external-store-proxy` throws them
 * twenty-eight times and used to import them from `@src/infra/exceptions` — a
 * workspace library reaching into an application's source. That made the
 * package impossible to publish or consume outside this monorepo, and it was
 * permitted by a one-entry allowlist in `check-workspace-boundaries` with no
 * date, no issue and no reason. That entry is gone with this change.
 *
 * ## Why this does not extend the application's `BaseError`
 *
 * `BaseError` reads a correlation id out of the application's async-local
 * `Context`. Dragging that here would move application infrastructure into a
 * contracts package in order to fix a contracts package depending on
 * application infrastructure — the same coupling, pointing the other way.
 *
 * The application recognises these by `error.name`, not by `instanceof` —
 * `formatErrorMessage` in `shared/utils.ts` is a chain of name comparisons — so
 * the class identity was never the contract. What *is* the contract is the
 * serialized shape: `shared/utils.ts` reads `correlationId`, and the
 * application's exception suite calls `toJSON()`. Both are provided here, the
 * id through an injected resolver rather than by importing the application's
 * `Context`.
 */
export abstract class PersistenceError extends Error {
  abstract readonly code: string;

  abstract readonly name: string;

  readonly correlationId: string;

  constructor(
    override readonly message: string,
    readonly cause?: Error,
    readonly metadata?: unknown
  ) {
    super(message);
    this.correlationId = currentCorrelationId();
    // Without this the stack starts inside this constructor rather than at the
    // line that threw, which is the only line a reader wants. Optional-called
    // because it is a V8 extension rather than a language guarantee.
    Error.captureStackTrace?.(this, this.constructor);
  }

  /**
   * The same shape the application's `ISerializedError` describes.
   *
   * `cause` is stringified rather than nested, matching `BaseError`, because an
   * Error does not survive `JSON.stringify` — it serializes to `{}` and the
   * reason for the failure disappears from the report.
   */
  toJSON(): {
    message: string;
    code: string;
    stack?: string;
    correlationId: string;
    cause: string;
    metadata: unknown;
    } {
    return {
      message: this.message,
      code: this.code,
      stack: this.stack,
      correlationId: this.correlationId,
      cause: JSON.stringify(this.cause),
      metadata: this.metadata
    };
  }
}
