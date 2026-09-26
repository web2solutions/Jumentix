import { describe, expect, it } from 'bun:test';

// eslint-disable-next-line import-x/no-relative-packages -- suite lives in ci-cd (JUM-824 ownership) while the script under test is owned by apps/backend-template, which is not linked as a root-resolvable workspace dependency
import { parseArgs } from '../apps/backend-template/scripts/purge-tombstones.js';

describe('purge-tombstones CLI flags', () => {
  it('defaults to dry-run, 90 days, seed protection', () => {
    expect.hasAssertions();
    const flags = parseArgs([]);
    expect(flags.commit).toBe(false);
    expect(flags.olderThan).toBe(90);
    expect(flags.protectSeed).toBe(true);
    expect(flags.viaLoopback).toBe(false);
  });

  it('accepts commit and loopback', () => {
    expect.hasAssertions();
    const flags = parseArgs(['--via-loopback', '--commit', '--older-than', '90']);
    expect(flags.commit).toBe(true);
    expect(flags.viaLoopback).toBe(true);
    expect(flags.olderThan).toBe(90);
  });

  it('refuses a non-positive retention', () => {
    expect.hasAssertions();
    expect(() => parseArgs(['--older-than', '0'])).toThrow(
      '--older-than must be a positive number of days'
    );
  });
});
