const { defineConfig } = require('cypress');

/**
 * Requirement 112 §4 — a package that runs in a browser is verified in a real
 * browser, headless, with no shims and no fake libraries.
 *
 * `packages/cana` drives IndexedDB. IndexedDB is a browser API, and the
 * behaviours worth testing are the ones a reimplementation is least likely to
 * reproduce: real quota, upgrade blocking while another connection holds the
 * database, the structured-clone boundary, what a transaction does when it
 * auto-commits. A suite that passes against a fake and fails against Chrome
 * proves the fake.
 *
 * There is deliberately nothing else here. No application under test, no
 * bundler configuration, no fixtures, no static server: Cypress already serves
 * the runner from a real http origin, and a real origin is all IndexedDB needs.
 * The specs import Cana from source and call the browser's own `indexedDB`.
 *
 * An earlier version of this file started a harness server of its own and
 * crashed Cypress before any spec ran — the config is compiled through Cypress's
 * bundled webpack, and that compile is not a place to need anything.
 */
module.exports = defineConfig({
  video: false,
  screenshotOnRunFailure: false,
  e2e: {
    // Bundled JavaScript, not the TypeScript sources: `ci-cd/run-browser-tests.js`
    // builds the specs with Bun first, and explains why.
    specPattern: '.browser-tests/**/*.cy.js',
    supportFile: 'cypress/support/e2e.js',
    setupNodeEvents(on) {
      // The browser cannot write files, and the coverage it produced has to
      // outlive it — Requirement 112 §4 makes this run responsible for the
      // coverage contract, not a Node run alongside it.
      const fs = require('node:fs');
      const path = require('node:path');
      const rawDir = path.join(__dirname, '.browser-tests', '.coverage');
      let written = 0;

      on('task', {
        'browser:coverage': (coverage) => {
          fs.mkdirSync(rawDir, { recursive: true });
          written += 1;
          fs.writeFileSync(path.join(rawDir, `spec-${written}.json`), JSON.stringify(coverage));
          return null;
        }
      });

      return undefined;
    }
  }
});
