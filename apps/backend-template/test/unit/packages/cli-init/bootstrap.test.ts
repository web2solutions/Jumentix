/* eslint-disable @typescript-eslint/no-var-requires */
const {
  BOILERPLATE_REPOSITORY
} = require('../../../../../../packages/cli-init/src/bootstrap');

describe('jumentix bootstrap repository policy', () => {
  it('clones only from the canonical XpertMinds application repository by default', () => {
    expect.hasAssertions();
    expect(BOILERPLATE_REPOSITORY).toBe('https://github.com/XpertMinds/Jumentix.git');
    expect(BOILERPLATE_REPOSITORY).not.toContain('web2solutions');
  });
});
