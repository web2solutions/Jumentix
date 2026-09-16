const { defineConfig } = require('cypress');

/**
 * Frontend e2e (JUM-776). `baseUrl` is injected by `scripts/run-e2e.mjs`, which
 * also owns the Dockerised backend the specs talk to. Videos are off — the
 * evidence Requirement 130 asks for is the run summary and screenshots on
 * failure, both kept.
 */
module.exports = defineConfig({
  e2e: {
    baseUrl: 'http://127.0.0.1:3131',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    supportFile: 'cypress/support/e2e.ts',
    video: false,
    screenshotOnRunFailure: true,
    viewportWidth: 1440,
    viewportHeight: 900,
    defaultCommandTimeout: 10000
  }
});
