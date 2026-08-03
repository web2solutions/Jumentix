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
  // Privileged commands (cy.task among them) are verified against the spec
  // frame's document. Since Cypress 14 that verification breaks in some
  // frames without this flag, and the browser coverage write-out in
  // `cypress/support/e2e.js` fails as "must only be invoked from the spec
  // file or support file" — from the support file itself (JUM-417, WebKit).
  injectDocumentDomain: true,
  // WebKit is Playwright's build of Safari's engine (JUM-417). The matrix runs
  // Cana's IndexedDB behaviour where engines actually differ: Safari's quota
  // and eviction policy is the strictest of the three and is the reason the
  // cross-browser issue exists. The flag is Cypress's own opt-in; the browser
  // binary comes from the `playwright-webkit` dev dependency.
  experimentalWebKitSupport: true,
  video: false,
  screenshotOnRunFailure: false,
  e2e: {
    // Bundled JavaScript, not the TypeScript sources: `ci-cd/run-browser-tests.js`
    // builds the specs with Bun first, and explains why.
    specPattern: '.browser-tests/**/*.cy.js',
    supportFile: 'cypress/support/e2e.js',
    setupNodeEvents(on, config) {
      // The browser cannot write files, and the coverage it produced has to
      // outlive it — Requirement 112 §4 makes this run responsible for the
      // coverage contract, not a Node run alongside it.
      const fs = require('node:fs');
      const path = require('node:path');
      const http = require('node:http');
      const rawDir = path.join(__dirname, '.browser-tests', '.coverage');
      let written = 0;

      const writeCoverage = (coverage) => {
        if (!coverage) return;
        fs.mkdirSync(rawDir, { recursive: true });
        written += 1;
        fs.writeFileSync(path.join(rawDir, `spec-${written}.json`), JSON.stringify(coverage));
      };

      // Two routes in, because the engines disagree on what a hook may do.
      //
      // The task is what Chrome-family and Firefox use: a privileged command,
      // verified against the spec frame, the documented way out of a browser.
      on('task', {
        'browser:coverage': (coverage) => {
          writeCoverage(coverage);
          return null;
        }
      });

      // Under WebKit the privileged-command verifier refuses `cy.task` from
      // ANY hook — "must only be invoked from the spec file or support file",
      // from the support file itself (JUM-417). What a hook may always do is
      // speak HTTP. This loopback server is the other route in: the support
      // file POSTs the coverage object, and no privileged verifier watches a
      // fetch. Bound to 127.0.0.1, lifetime of the run, one endpoint, and the
      // port is handed to the spec as an env so it is never guessed.
      const coverageServer = http.createServer((req, res) => {
        if (req.method !== 'POST' || req.url !== '/browser-coverage') {
          res.statusCode = 404;
          res.end();
          return;
        }
        let body = '';
        req.on('data', (chunk) => { body += chunk; });
        req.on('end', () => {
          try {
            // Two shapes arrive here: the support file's form POST (a single
            // `coverage` field, urlencoded) and the task fallback's raw JSON.
            let coverage = null;
            if (req.headers['content-type']?.includes('application/x-www-form-urlencoded')) {
              const params = new URLSearchParams(body);
              coverage = JSON.parse(params.get('coverage') || 'null');
            } else {
              coverage = JSON.parse(body);
            }
            writeCoverage(coverage);
            // A tiny HTML page so the form's iframe navigation completes.
            res.statusCode = 200;
            res.setHeader('Content-Type', 'text/html');
            res.end('<!doctype html><title>ok</title>');
          } catch {
            res.statusCode = 400;
            res.end();
          }
        });
      });

      return new Promise((resolve) => {
        coverageServer.listen(0, '127.0.0.1', () => {
          const { port } = coverageServer.address();
          // Cypress.env is readable from the support file on every engine.
          config.env.CANA_COVERAGE_URL = `http://127.0.0.1:${port}/browser-coverage`;
          on('after:run', () => new Promise((done) => coverageServer.close(done)));
          resolve(config);
        });
      });
    }
  }
});
