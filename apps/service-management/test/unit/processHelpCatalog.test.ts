/* eslint-disable jest/prefer-expect-assertions, jest/prefer-strict-equal */
import { EXACT_HELP, ROLE_HELP, describeProcessHelp } from '../../src/ui/processHelpCatalog.js';

describe('processHelpCatalog', () => {
  it('resolves known ecosystem names and role suffixes', () => {
    expect.hasAssertions();
    expect(describeProcessHelp({ name: 'jumentix-dev-restapi' }).source).toBe('catalog');
    expect(describeProcessHelp({ name: 'jumentix-dev-restapi' }).summary).toContain('RestAPI');
    expect(describeProcessHelp({ name: 'jumentix-staging-websocketapi' }).source).toBe('catalog');
    expect(describeProcessHelp({ name: 'jumentix-production-grpcapi' }).summary).toContain('gRPC');
  });

  it('describes every catalogued ecosystem name with its catalog entry', () => {
    expect.hasAssertions();
    expect(Object.keys(EXACT_HELP)).toHaveLength(15);
    Object.entries(EXACT_HELP).forEach(([name, summary]) => {
      expect(describeProcessHelp({ name })).toStrictEqual({ summary, source: 'catalog' });
    });
  });

  it('trims surrounding whitespace before matching the catalog', () => {
    expect.hasAssertions();
    const help = describeProcessHelp({ name: '  jumentix-production-service-management  ' });
    expect(help.source).toBe('catalog');
    expect(help.summary).toBe(ROLE_HELP['service-management']);
  });

  it('matches by role suffix when a jumentix-shaped name has no exact catalog entry', () => {
    expect.hasAssertions();
    // The exact map and the role map are kept in sync today, so the only way
    // to observe the documented role-suffix level is a name missing from the
    // exact map. Remove one entry, assert the role fallback answers, restore.
    const exact = EXACT_HELP['jumentix-dev-restapi'];
    try {
      delete (EXACT_HELP as Record<string, string>)['jumentix-dev-restapi'];
      const help = describeProcessHelp({ name: 'jumentix-dev-restapi' });
      expect(help.source).toBe('catalog-role');
      expect(help.summary).toBe(ROLE_HELP.restapi);
    } finally {
      EXACT_HELP['jumentix-dev-restapi'] = exact;
    }
  });

  it('falls back to script and interpreter when the name is unknown', () => {
    expect.hasAssertions();
    const help = describeProcessHelp({
      name: 'custom-worker',
      script: './workers/run.js',
      interpreter: 'bun'
    });
    expect(help.source).toBe('fallback');
    expect(help.summary).toBe('Runs ./workers/run.js via bun.');
  });

  it('falls back for jumentix-shaped names whose role is not catalogued', () => {
    expect.hasAssertions();
    const help = describeProcessHelp({
      name: 'jumentix-staging-billing-worker',
      script: './billing.js'
    });
    expect(help.source).toBe('fallback');
    expect(help.summary).toBe('Runs ./billing.js via default interpreter.');
  });

  it('describes anonymous processes with placeholder script and interpreter', () => {
    expect.hasAssertions();
    expect(describeProcessHelp()).toStrictEqual({
      summary: 'Runs (unknown script) via default interpreter.',
      source: 'fallback'
    });
    expect(describeProcessHelp({ name: '   ' })).toStrictEqual({
      summary: 'Runs (unknown script) via default interpreter.',
      source: 'fallback'
    });
  });

  it('falls back per-field: blank script or blank interpreter get their own placeholder', () => {
    expect.hasAssertions();
    expect(describeProcessHelp({ name: 'worker', interpreter: 'node' }).summary)
      .toBe('Runs (unknown script) via node.');
    expect(describeProcessHelp({ name: 'worker', script: '  ./run.js  ', interpreter: '   ' }).summary)
      .toBe('Runs ./run.js via default interpreter.');
  });
});
