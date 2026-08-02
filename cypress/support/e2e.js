/**
 * Support file for the browser suites (Requirement 112 §4).
 *
 * One job: every database a spec opens is deleted when the test ends.
 *
 * Real IndexedDB persists. That is the point of it, and it is the sharpest
 * difference from a fake that is rebuilt for every test — left alone, the second
 * run of a suite meets the first run's data, and a test that passes only on a
 * clean profile fails in CI and passes on the machine of whoever is asked to
 * look at it.
 *
 * Plain JavaScript, like the config: Cypress compiles its support file through
 * the same bundler that cannot compile TypeScript here.
 */

/**
 * The browser's coverage, written out after every spec.
 *
 * Requirement 112 §4 makes the browser run responsible for the coverage
 * contract, so what the instrumented bundle leaves on `window` has to survive
 * the browser closing. Cypress cannot write files from the browser, so it goes
 * through a task.
 */
after(() => {
  // `window`, not `cy.window()`. The instrumented spec runs in the spec frame;
  // `cy.window()` hands back the application frame, which never ran any of it —
  // and reading the wrong window produced a run where every spec passed and the
  // coverage report was empty.
  const collected = window.__coverage__;
  if (!collected) return undefined;
  return cy.task('browser:coverage', collected, { log: false });
});

afterEach(() => cy.window({ log: false }).then((browserWindow) => {
  const factory = browserWindow.indexedDB;

  // `databases()` is how a spec's leftovers are found without the suite having
  // to remember its own names. Where a browser lacks it, the suite is
  // responsible for its own cleanup and says so.
  if (typeof factory.databases !== 'function') return undefined;

  return factory.databases().then((open) => Promise.all(open.map((entry) => (
    new Promise((resolve) => {
      if (!entry.name) {
        resolve();
        return;
      }
      const request = factory.deleteDatabase(entry.name);
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
      request.onblocked = () => resolve();
    })
  ))));
}));
