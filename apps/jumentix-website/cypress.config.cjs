const { defineConfig } = require('cypress');

/**
 * JUM-396 — website quality gates.
 *
 * Kept separate from the root `cypress.config.js` (Cana IndexedDB matrix).
 * This config points at the Next.js website on port 3010 and never loads
 * Cana browser coverage plumbing.
 */
module.exports = defineConfig({
  video: false,
  screenshotOnRunFailure: true,
  retries: { runMode: 1, openMode: 0 },
  e2e: {
    baseUrl: process.env.JUMENTIX_WEBSITE_BASE_URL || 'http://127.0.0.1:3010',
    supportFile: 'cypress/support/e2e.js',
    // Explicit extension — brace globs have been flaky when Cypress is
    // launched with an absolute --config-file from the monorepo root binary.
    specPattern: 'cypress/e2e/**/*.cy.js',
    viewportWidth: 1280,
    viewportHeight: 800,
    defaultCommandTimeout: 15000,
    pageLoadTimeout: 60000,
    setupNodeEvents(on) {
      on('task', {
        log(message) {
          console.log(message);
          return null;
        }
      });
    }
  }
});
