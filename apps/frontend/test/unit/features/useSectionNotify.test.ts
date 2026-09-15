import { describe, expect, it } from 'bun:test';

import { useSectionNotify } from '@/features/profile/useSectionNotify';

import { setLocale } from '@/i18n';

setLocale('en');

/** Per-section profile feedback (JUM-765): success, stale-delete and failure. */
describe('useSectionNotify (JUM-765)', () => {
  it('shows the success text after a successful action', async () => {
    expect.hasAssertions();
    const { successMessage, errorMessage, run } = useSectionNotify();
    await run(async () => undefined, 'Saved.');
    expect(successMessage.value).toBe('Saved.');
    expect(errorMessage.value).toBe('');
  });

  it('translates an already-removed outcome into the stale-delete message', async () => {
    expect.hasAssertions();
    const { successMessage, run } = useSectionNotify();
    await run(async () => 'already-removed' as const, 'Saved.');
    expect(successMessage.value).toBe('Already removed — list refreshed.');
  });

  it('shows the formatted API error after a failed action', async () => {
    expect.hasAssertions();
    const { successMessage, errorMessage, run } = useSectionNotify();
    await run(async () => {
      throw new Error('REST request failed: 400 {"message":"username can not be empty"}');
    }, 'Saved.');
    expect(errorMessage.value).toBe('username can not be empty');
    expect(successMessage.value).toBe('');
  });

  it('clears the previous message on each run', async () => {
    expect.hasAssertions();
    const { successMessage, errorMessage, run } = useSectionNotify();
    await run(async () => {
      throw new Error('boom');
    }, 'Saved.');
    expect(errorMessage.value).toBe('boom');
    await run(async () => undefined, 'Saved.');
    expect(errorMessage.value).toBe('');
    expect(successMessage.value).toBe('Saved.');
  });
});
