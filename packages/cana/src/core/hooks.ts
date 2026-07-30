/**
 * Lifecycle hooks (JUM-408).
 *
 * Hooks are where an extensibility API usually acquires its worst properties, so
 * three restrictions are built into the types rather than left to documentation.
 *
 * **In-transaction hooks are synchronous, by signature.** `beforeWrite` returns
 * a value, never a promise. This is not a stylistic preference: a hook that
 * awaited anything foreign would close the transaction's auto-commit window, and
 * the write that follows would fail with `TransactionInactive` from inside
 * engine code the hook author never sees. Making it impossible to write the
 * async version is the only enforcement that actually holds.
 *
 * **A hook cannot swallow a failure.** There is no `onError` that returns a
 * substitute result. A `beforeWrite` that throws vetoes the write and aborts the
 * transaction — that is the intended veto mechanism, and it fails loudly. What
 * a hook may not do is observe a failure and report success in its place.
 *
 * **`afterCommit` cannot change what anyone else sees.** It runs after durability
 * with frozen events, so a hook cannot rewrite history for later subscribers,
 * and a hook that throws does not undo a commit that already happened — the
 * write is on disk, and pretending otherwise would be a lie about durability.
 */

import type { CanaChangeEvent, CanaChangeType, CanaKey } from '../contracts';
import { canaError, translateError } from './errors';

export interface WriteHookContext {
  readonly store: string;
  readonly type: CanaChangeType;
  readonly key?: CanaKey;
  readonly record?: unknown;
  readonly correlationId: string;
}

export interface CanaHooks {
  /**
   * Runs inside the transaction, before the write is issued.
   *
   * Return a replacement record to transform it (stamping `updatedAt` is the
   * canonical use), or nothing to leave it alone. Throw to veto: the transaction
   * aborts and nothing is written.
   *
   * Synchronous by signature — see the module note.
   */
  readonly beforeWrite?: (context: WriteHookContext) => unknown | void;

  /**
   * Runs after the transaction has committed, with the events it produced.
   *
   * The events are frozen. A throw here is isolated: the data is already
   * durable, so failing the call would misreport a write that did happen.
   */
  readonly afterCommit?: (events: readonly CanaChangeEvent[]) => void;

  /**
   * Runs after a transaction ended without committing.
   *
   * Given the outcome so a hook can distinguish a clean rollback from the
   * `unknown` case, which is the one that needs reconciliation (JUM-559).
   */
  readonly afterRollback?: (outcome: 'rolled-back' | 'unknown', reason?: string) => void;
}

function isThenable(value: unknown): boolean {
  return typeof value === 'object'
    && value !== null
    && typeof (value as { then?: unknown }).then === 'function';
}

/**
 * Apply `beforeWrite` and return the record to write.
 *
 * A returned `undefined` means "unchanged", which is why the original is passed
 * through rather than replaced with the return value unconditionally. A hook
 * that forgets to return would otherwise silently blank every record it touches.
 */
export function applyBeforeWrite(
  hooks: CanaHooks | undefined,
  context: WriteHookContext,
  record: unknown
): unknown {
  if (!hooks?.beforeWrite) return record;

  let replacement: unknown;
  try {
    replacement = hooks.beforeWrite(context);
  } catch (error) {
    // Deliberately not swallowed. A veto is a real outcome and the caller must
    // see it; the transaction runner turns this into an abort.
    throw translateError(error, {
      store: context.store,
      ...(context.key === undefined ? {} : { key: context.key })
    });
  }

  if (replacement !== undefined && isThenable(replacement)) {
    // The signature forbids this, but JavaScript callers have no compiler. An
    // awaited promise here would already have cost the transaction, so this
    // fails clearly instead of writing a Promise object into the store.
    throw canaError(
      'InvalidRequest',
      `beforeWrite on "${context.store}" returned a promise. Hooks that run inside a transaction `
        + 'must be synchronous: awaiting anything closes the auto-commit window and the write '
        + 'that follows would fail with TransactionInactive.',
      { store: context.store }
    );
  }

  return replacement === undefined ? record : replacement;
}

/** Notify `afterCommit` with frozen events, isolating a throw. */
export function notifyCommitted(
  hooks: CanaHooks | undefined,
  events: readonly CanaChangeEvent[]
): void {
  if (!hooks?.afterCommit || events.length === 0) return;
  try {
    hooks.afterCommit(Object.freeze(events.map((event) => Object.freeze({ ...event }))));
  } catch {
    // The write is durable. Propagating would report a failure for something
    // that succeeded, which is the false-negative half of a false green.
  }
}

/** Notify `afterRollback`, isolating a throw. */
export function notifyRolledBack(
  hooks: CanaHooks | undefined,
  outcome: 'rolled-back' | 'unknown',
  reason?: string
): void {
  if (!hooks?.afterRollback) return;
  try {
    hooks.afterRollback(outcome, reason);
  } catch {
    // The transaction already failed; a failing hook must not mask why.
  }
}
