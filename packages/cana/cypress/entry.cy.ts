/**
 * Loads the public barrel so `packages/cana/src/index.ts` is in the browser
 * coverage report.
 *
 * Specs import named symbols from `../src`, and the bundler tree-shakes the
 * re-export file out of the source map. Sonar still counts that barrel as
 * source: absent from LCOV it is 0% on new code. Importing the module namespace
 * keeps the barrel in the map and measures the runtime re-exports.
 */
import {
  CANA_PACKAGE,
  createClient,
  isCanaError,
  openDatabase,
  runConformance,
  StorageDurability
} from '../src';

describe('cana public entry', () => {
  it('exposes the runtime surface the package documents', () => {
    expect(CANA_PACKAGE).to.equal('cana');
    expect(typeof createClient).to.equal('function');
    expect(typeof openDatabase).to.equal('function');
    expect(typeof isCanaError).to.equal('function');
    expect(typeof runConformance).to.equal('function');
    expect(typeof StorageDurability).to.equal('function');
  });
});
