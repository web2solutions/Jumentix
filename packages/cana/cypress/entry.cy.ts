/**
 * Loads the public barrel so `packages/cana/src/index.ts` is in the browser
 * coverage report.
 *
 * Specs import named symbols from `../src`, and the bundler tree-shakes the
 * re-export file out of the source map. Sonar still counts that barrel as
 * source: absent from LCOV it is 0% on new code. Importing the module namespace
 * keeps the barrel in the map and measures the runtime re-exports.
 */
import * as cana from '../src';

describe('cana public entry', () => {
  it('exposes the runtime surface the package documents', () => {
    expect(typeof cana.createClient).to.equal('function');
    expect(typeof cana.openDatabase).to.equal('function');
    expect(typeof cana.isCanaError).to.equal('function');
    expect(typeof cana.runConformance).to.equal('function');
    expect(typeof cana.StorageDurability).to.equal('function');
  });
});
