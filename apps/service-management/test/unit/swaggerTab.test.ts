/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable jest/prefer-expect-assertions */

const { selectOasForService } = require('../../src/ui/swaggerTab.js');

describe('swagger tab service selector (JUM-818)', () => {
  it('returns the merged document or a per-service filter', () => {
    expect.hasAssertions();
    const documentSet = {
      merged: { info: { title: 'Merged' }, paths: { '/a': {} } },
      services: {
        core: { info: { title: 'Core' }, paths: { '/users': {} } }
      }
    };
    expect(selectOasForService(documentSet, 'merged').info.title).toBe('Merged');
    expect(selectOasForService(documentSet, 'core').info.title).toBe('Core');
    expect(selectOasForService(documentSet, 'missing').info.title).toBe('Merged');
  });
});
