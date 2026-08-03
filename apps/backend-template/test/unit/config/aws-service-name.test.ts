describe('serverless configuration', () => {
  it('uses the Jumentix service name', () => {
    expect.hasAssertions();
    // eslint-disable-next-line max-len
    // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires, import/no-dynamic-require
    const config = require('../../../../../serverless');
    expect(config.service).toBe('jumentix');
  });
});
