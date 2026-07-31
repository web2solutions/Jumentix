import type { CanaStorageState } from '@jumentix/cana';
import {
  DEFAULT_DURABILITY_POLICY,
  assessDurability,
  requiresUserAttention
} from '@jumentix/cana';

/**
 * The policy is pure, so it is tested directly rather than through a database.
 * What matters here is which way each ambiguous case rounds — and every one of
 * them rounds away from claiming a guarantee the engine cannot support.
 */

const state = (over: Partial<CanaStorageState> = {}): CanaStorageState => ({
  persistent: 'unknown',
  nearQuota: false,
  evicted: false,
  ...over
});

describe('cana durability policy', () => {
  it('does not treat unconfirmed persistence as durable', () => {
    expect.hasAssertions();
    // The central rounding. 'unknown' means no evidence, and no evidence is not
    // a guarantee — an app that showed "your data is safe" here would be lying.
    const assessment = assessDurability(state({ persistent: 'unknown' }));

    expect(assessment.level).toBe('best-effort');
    expect(assessment.summary).toContain('could not be confirmed');
    expect(assessment.advice.join(' ')).toContain('no evidence');
  });

  it('distinguishes a refusal from an inability to tell', () => {
    expect.hasAssertions();
    // Both are 'best-effort', but they call for different messages: one is a
    // decision the browser made, the other is missing information.
    const refused = assessDurability(state({ persistent: false }));
    const unknown = assessDurability(state({ persistent: 'unknown' }));

    expect(refused.level).toBe('best-effort');
    expect(unknown.level).toBe('best-effort');
    expect(refused.summary).toContain('did not grant');
    expect(unknown.summary).toContain('could not be confirmed');
  });

  it('reports granted persistence as durable, with nothing to do', () => {
    expect.hasAssertions();
    const assessment = assessDurability(
      state({ persistent: true }),
      { evicted: false, reason: 'existing-data' }
    );

    expect(assessment.level).toBe('durable');
    expect(assessment.advice).toStrictEqual([]);
  });

  it('treats near-quota as its own state, not as healthy and not as failed', () => {
    expect.hasAssertions();
    // The only warning that arrives before data loss. Folding it into either
    // neighbour throws it away.
    const assessment = assessDurability(
      state({
        persistent: true, nearQuota: true, usageBytes: 90, quotaBytes: 100
      })
    );

    expect(assessment.level).toBe('at-risk');
    expect(assessment.summary).toContain('90%');
    expect(requiresUserAttention(assessment.level)).toBe(true);
  });

  it('does not tell an at-risk app to request persistence it already has', () => {
    expect.hasAssertions();
    const granted = assessDurability(state({ persistent: true, nearQuota: true }));
    const notGranted = assessDurability(state({ persistent: false, nearQuota: true }));

    expect(granted.advice.join(' ')).not.toContain('Request persistent storage');
    expect(notGranted.advice.join(' ')).toContain('Request persistent storage');
  });

  it('reports eviction as loss and says the app must not look like a fresh install', () => {
    expect.hasAssertions();
    // The JUM-560 failure mode: an evicted database and a new one both open
    // empty, and showing the second is how a user loses work without being told.
    const assessment = assessDurability(
      state({ evicted: true }),
      { evicted: true, reason: 'evicted-database-absent' }
    );

    expect(assessment.level).toBe('lost');
    expect(assessment.advice.join(' ')).toContain('fresh install');
    expect(requiresUserAttention(assessment.level)).toBe(true);
  });

  it('surfaces undetectable eviction rather than reporting "not evicted"', () => {
    expect.hasAssertions();
    // Without a tombstone the engine cannot ever tell a wipe from a first run.
    // Saying "not evicted" would be a claim it has no basis for.
    const assessment = assessDurability(
      state({ persistent: false }),
      { evicted: false, reason: 'undetectable-no-tombstone' }
    );

    expect(assessment.evictionDetectable).toBe(false);
    expect(assessment.advice.join(' ')).toContain('indistinguishable from a first run');
  });

  it('flags undetectable eviction even when storage is durable', () => {
    expect.hasAssertions();
    // Persistence and detectability are independent: a granted-persistent origin
    // with no tombstone is still blind if a wipe happens anyway.
    const assessment = assessDurability(
      state({ persistent: true }),
      { evicted: false, reason: 'undetectable-no-tombstone' }
    );

    expect(assessment.level).toBe('durable');
    expect(assessment.evictionDetectable).toBe(false);
    expect(assessment.advice).toHaveLength(1);
  });

  it('falls back to a non-numeric summary when usage is unavailable', () => {
    expect.hasAssertions();
    const assessment = assessDurability(state({ nearQuota: true }));

    expect(assessment.summary).toContain('close to its quota');
    expect(assessment.summary).not.toContain('NaN');
  });

  it('defaults to not prompting for persistence on open', () => {
    expect.hasAssertions();
    // A prompt fired by a library at an arbitrary moment is a prompt that gets
    // denied, and the origin may be stuck with that denial.
    expect(DEFAULT_DURABILITY_POLICY.requestPersistenceOnOpen).toBe(false);
  });

  it('does not demand attention for the two states the user cannot act on', () => {
    expect.hasAssertions();
    expect(requiresUserAttention('durable')).toBe(false);
    expect(requiresUserAttention('best-effort')).toBe(false);
  });
});
