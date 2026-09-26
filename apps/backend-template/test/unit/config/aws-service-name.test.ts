describe('serverless configuration', () => {
  it('uses the Jumentix service name', () => {
    expect.hasAssertions();

    const config = require('../../../../../serverless');
    expect(config.service).toBe('jumentix');
  });
});
