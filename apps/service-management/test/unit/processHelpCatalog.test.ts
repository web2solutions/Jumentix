/* eslint-disable jest/prefer-expect-assertions, jest/prefer-strict-equal */
import { describeProcessHelp } from '../../src/ui/processHelpCatalog.js';

describe('processHelpCatalog', () => {
  it('resolves known ecosystem names and role suffixes', () => {
    expect.hasAssertions();
    expect(describeProcessHelp({ name: 'jumentix-dev-restapi' }).source).toBe('catalog');
    expect(describeProcessHelp({ name: 'jumentix-dev-restapi' }).summary).toContain('RestAPI');
    expect(describeProcessHelp({ name: 'jumentix-staging-websocketapi' }).source).toBe('catalog');
    expect(describeProcessHelp({ name: 'jumentix-production-grpcapi' }).summary).toContain('gRPC');
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
});
