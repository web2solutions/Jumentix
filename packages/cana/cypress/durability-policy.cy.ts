import type { CanaStorageState } from '../src';
import {
  DEFAULT_DURABILITY_POLICY,
  assessDurability,
  requiresUserAttention
} from '../src';

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
    // The central rounding. 'unknown' means no evidence, and no evidence is not
    // a guarantee — an app that showed "your data is safe" here would be lying.
    const assessment = assessDurability(state({ persistent: 'unknown' }));

    expect(assessment.level).to.equal('best-effort');
    expect(assessment.summary).to.include('could not be confirmed');
    expect(assessment.advice.join(' ')).to.include('no evidence');
  });

  it('distinguishes a refusal from an inability to tell', () => {
    // Both are 'best-effort', but they call for different messages: one is a
    // decision the browser made, the other is missing information.
    const refused = assessDurability(state({ persistent: false }));
    const unknown = assessDurability(state({ persistent: 'unknown' }));

    expect(refused.level).to.equal('best-effort');
    expect(unknown.level).to.equal('best-effort');
    expect(refused.summary).to.include('did not grant');
    expect(unknown.summary).to.include('could not be confirmed');
  });

  it('reports granted persistence as durable, with nothing to do', () => {
    const assessment = assessDurability(
      state({ persistent: true }),
      { evicted: false, reason: 'existing-data' }
    );

    expect(assessment.level).to.equal('durable');
    expect(assessment.advice).to.deep.equal([]);
  });

  it('treats near-quota as its own state, not as healthy and not as failed', () => {
    // The only warning that arrives before data loss. Folding it into either
    // neighbour throws it away.
    const assessment = assessDurability(
      state({
        persistent: true, nearQuota: true, usageBytes: 90, quotaBytes: 100
      })
    );

    expect(assessment.level).to.equal('at-risk');
    expect(assessment.summary).to.include('90%');
    expect(requiresUserAttention(assessment.level)).to.equal(true);
  });

  it('does not tell an at-risk app to request persistence it already has', () => {
    const granted = assessDurability(state({ persistent: true, nearQuota: true }));
    const notGranted = assessDurability(state({ persistent: false, nearQuota: true }));

    expect(granted.advice.join(' ')).not.to.include('Request persistent storage');
    expect(notGranted.advice.join(' ')).to.include('Request persistent storage');
  });

  it('reports eviction as loss and says the app must not look like a fresh install', () => {
    // The JUM-560 failure mode: an evicted database and a new one both open
    // empty, and showing the second is how a user loses work without being told.
    const assessment = assessDurability(
      state({ evicted: true }),
      { evicted: true, reason: 'evicted-database-absent' }
    );

    expect(assessment.level).to.equal('lost');
    expect(assessment.advice.join(' ')).to.include('fresh install');
    expect(requiresUserAttention(assessment.level)).to.equal(true);
  });

  it('surfaces undetectable eviction rather than reporting "not evicted"', () => {
    // Without a tombstone the engine cannot ever tell a wipe from a first run.
    // Saying "not evicted" would be a claim it has no basis for.
    const assessment = assessDurability(
      state({ persistent: false }),
      { evicted: false, reason: 'undetectable-no-tombstone' }
    );

    expect(assessment.evictionDetectable).to.equal(false);
    expect(assessment.advice.join(' ')).to.include('indistinguishable from a first run');
  });

  it('flags undetectable eviction even when storage is durable', () => {
    // Persistence and detectability are independent: a granted-persistent origin
    // with no tombstone is still blind if a wipe happens anyway.
    const assessment = assessDurability(
      state({ persistent: true }),
      { evicted: false, reason: 'undetectable-no-tombstone' }
    );

    expect(assessment.level).to.equal('durable');
    expect(assessment.evictionDetectable).to.equal(false);
    expect(assessment.advice).to.have.lengthOf(1);
  });

  it('falls back to a non-numeric summary when usage is unavailable', () => {
    const assessment = assessDurability(state({ nearQuota: true }));

    expect(assessment.summary).to.include('close to its quota');
    expect(assessment.summary).not.to.include('NaN');
  });

  it('defaults to not prompting for persistence on open', () => {
    // A prompt fired by a library at an arbitrary moment is a prompt that gets
    // denied, and the origin may be stuck with that denial.
    expect(DEFAULT_DURABILITY_POLICY.requestPersistenceOnOpen).to.equal(false);
  });

  it('does not demand attention for the two states the user cannot act on', () => {
    expect(requiresUserAttention('durable')).to.equal(false);
    expect(requiresUserAttention('best-effort')).to.equal(false);
  });
});
