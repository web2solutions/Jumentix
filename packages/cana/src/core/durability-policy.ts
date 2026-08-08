/**
 * Durability policy (JUM-415).
 *
 * `storage.ts` answers mechanical questions — is it persistent, how full is it,
 * was it evicted. This file answers the product question: given those, what is
 * the application allowed to tell its user?
 *
 * It exists because the mechanical answers are easy to round off in the
 * dangerous direction. Three roundings are refused here:
 *
 * 1. **`persistent: 'unknown'` is not `durable`.** The Storage API is absent in
 *    some browsers and in some private modes. Treating absence as "probably
 *    fine" lets an application promise durability it has no evidence for, and
 *    the user finds out when their work is gone.
 *
 * 2. **Near-quota is not a failure, and not nothing.** It is the only warning
 *    that arrives *before* data loss. Collapsing it into "healthy" wastes the
 *    one chance to act; collapsing it into "failed" trains people to ignore it.
 *
 * 3. **Undetectable eviction is its own state.** When no tombstone can be
 *    written, the engine cannot tell a first run from a wipe — ever, for that
 *    origin. Reporting that as "not evicted" is a claim the engine cannot
 *    support (see JUM-560).
 *
 * The policy deliberately has no `recover()` that mutates stores. When the
 * localStorage fallback is active the assessment reports `best-effort` /
 * degraded capacity; promoting data still goes through the application's own
 * export/import — `CanaClient.exportAll()`.
 */

import type { CanaStorageState } from '../contracts';
import type { EvictionVerdict } from './storage';

/**
 * How durable the data actually is, worst case first.
 *
 * Ordered so a caller can compare, and named for what is true rather than for
 * how alarming it is.
 */
export type DurabilityLevel =
  /** Data was there and is gone. */
  | 'lost'
  /** Storage is close enough to quota that the browser may evict. */
  | 'at-risk'
  /** Not persistent, or persistence cannot be confirmed: eviction is possible. */
  | 'best-effort'
  /** The browser granted persistent storage. */
  | 'durable';

export interface DurabilityAssessment {
  readonly level: DurabilityLevel;
  /** True when the engine cannot detect eviction at all for this origin. */
  readonly evictionDetectable: boolean;
  /** Plain-language reason, suitable for showing a user. */
  readonly summary: string;
  /**
   * What the application should do, or an empty list when nothing is warranted.
   *
   * Advice is separate from the level because the same level can call for
   * different action depending on whether detection works.
   */
  readonly advice: readonly string[];
}

export interface DurabilityPolicy {
  /**
   * Whether to ask for persistent storage when the client opens.
   *
   * Defaults to false. Asking prompts the user in some browsers, and a prompt
   * fired by a library at an arbitrary moment is a prompt that gets denied — a
   * denial the origin may then be stuck with.
   */
  readonly requestPersistenceOnOpen?: boolean;
  /** Fraction of quota at which usage counts as at-risk. */
  readonly nearQuotaRatio?: number;
}

export const DEFAULT_DURABILITY_POLICY: Required<DurabilityPolicy> = {
  requestPersistenceOnOpen: false,
  nearQuotaRatio: 0.85
};

function usageSummary(state: CanaStorageState): string {
  const { usageBytes, quotaBytes } = state;
  if (usageBytes === undefined || quotaBytes === undefined || quotaBytes === 0) {
    return 'Storage is close to its quota.';
  }
  const percent = Math.round((usageBytes / quotaBytes) * 100);
  return `Storage is ${percent}% of the available quota.`;
}

/**
 * Turn observed storage state into a durability verdict.
 *
 * Pure, so the policy is testable without a browser and without the timing that
 * makes storage behaviour hard to reproduce.
 */
export function assessDurability(
  state: CanaStorageState,
  verdict?: EvictionVerdict | null
): DurabilityAssessment {
  const evictionDetectable = verdict?.reason !== 'undetectable-no-tombstone';

  if (state.evicted || verdict?.evicted === true) {
    return {
      level: 'lost',
      evictionDetectable,
      summary: 'The browser deleted this database to reclaim space. Local data written before '
        + 'now is gone and cannot be recovered from the browser.',
      advice: [
        'Tell the user their local data was cleared by the browser, rather than showing an '
          + 'empty app that looks like a fresh install.',
        'Re-sync from the server if there is one; otherwise the loss is final.',
        'Request persistent storage before writing again.'
      ]
    };
  }

  if (state.nearQuota) {
    return {
      level: 'at-risk',
      evictionDetectable,
      summary: `${usageSummary(state)
      } At this level the browser may evict the database without warning.`,
      advice: [
        'Free space: remove cached or derived records that can be rebuilt.',
        'Export anything the user cannot afford to lose.',
        ...(state.persistent === true
          ? []
          : ['Request persistent storage — it is the only thing that makes eviction unlikely.'])
      ]
    };
  }

  if (state.persistent === true) {
    return {
      level: 'durable',
      evictionDetectable,
      summary: 'The browser granted persistent storage: this database will not be evicted '
        + 'automatically under storage pressure.',
      advice: evictionDetectable
        ? []
        : ['Eviction cannot be detected for this origin, so a wipe would look like a first run.']
    };
  }

  // Covers both `false` and `'unknown'`, and says which — because "the browser
  // refused" and "we cannot tell" call for different messages, even though
  // neither is a durability guarantee.
  const reason = state.persistent === false
    ? 'The browser did not grant persistent storage'
    : 'Persistent storage could not be confirmed in this browser';

  return {
    level: 'best-effort',
    evictionDetectable,
    summary: `${reason}, so this database can be evicted under storage pressure.`,
    advice: [
      ...(state.persistent === false
        ? ['Persistence was refused; treat local data as a cache, not as the record of truth.']
        : ['Do not report local data as durable — there is no evidence that it is.']),
      ...(evictionDetectable
        ? []
        : ['Eviction is undetectable for this origin: a wipe would be indistinguishable from a '
          + 'first run, so the app cannot tell the user what happened.'])
    ]
  };
}

/** True when the level means the application should stop treating writes as safe. */
export function requiresUserAttention(level: DurabilityLevel): boolean {
  return level === 'lost' || level === 'at-risk';
}
