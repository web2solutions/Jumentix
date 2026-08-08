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

  // Under WebKit the privileged-command verifier refuses `cy.task` from any
  // hook — "must only be invoked from the spec file or support file", from
  // this very file (JUM-417). What a hook may always do is speak HTTP, and
  // `setupNodeEvents` started a loopback server for exactly this: no
  // privileged command, works from a hook, on every engine. The URL arrives
  // as an env rather than being guessed.
  const url = Cypress.env('CANA_COVERAGE_URL');
  if (!url) {
    // Fallback for a runner that never started the coverage server: the task,
    // which is the documented route on the engines that honour it.
    return cy.task('browser:coverage', collected, { log: false });
  }

  // The spec frame's CSP (`setSpecContentSecurityPolicy` in the runner) does
  // not declare `connect-src`, so a `fetch`/`sendBeacon` to the coverage
  // server is blocked before it leaves the browser on engines that enforce it
  // from a hook — WebKit's "Load failed" is exactly that. A form POST is not
  // script-controlled and is not subject to connect-src: the body rides as a
  // plain field, targeted at a throwaway iframe so the frame itself navigates
  // nowhere. No privileged command, no CSP-covered API, every engine.
  const form = window.document.createElement('form');
  form.method = 'POST';
  form.action = url;
  form.target = 'cana-coverage-frame';
  form.style.display = 'none';

  const field = window.document.createElement('input');
  field.type = 'hidden';
  field.name = 'coverage';
  field.value = JSON.stringify(collected);
  form.appendChild(field);

  const frame = window.document.createElement('iframe');
  frame.name = 'cana-coverage-frame';
  frame.style.display = 'none';

  window.document.body.appendChild(frame);
  window.document.body.appendChild(form);

  // The POST must be awaited, not fired and forgotten: `after:run` closes the
  // loopback server, and a hook that returns immediately lets the run end while
  // the body is still on the wire — coverage then silently never reaches disk.
  // The iframe's `load` fires only when the server's response arrives, and the
  // server responds only after the file is written, so awaiting it is awaiting
  // the write itself. A returned promise is awaited by the hook (no cy.*
  // commands are enqueued in this branch, so Mocha semantics apply). The
  // timeout exists so a dead server fails the run loudly instead of hanging it
  // — a coverage transport that never answers is a broken run, not a pass.
  return new Promise((resolve, reject) => {
    const giveUp = window.setTimeout(() => {
      reject(new Error(`Coverage POST to ${url} did not complete within 10s.`));
    }, 10000);

    frame.addEventListener('load', () => {
      window.clearTimeout(giveUp);
      form.remove();
      frame.remove();
      resolve();
    });

    form.submit();
  });
});

/**
 * How long the teardown is given, and why it is not the command default
 * (JUM-618).
 *
 * Cypress's `defaultCommandTimeout` is 4000ms, and it applied here because this
 * hook is a `cy.*` command like any other. That is the wrong budget for it. The
 * default exists so an *assertion* about the application fails fast rather than
 * hanging a run — but this hook asserts nothing about Cana. It deletes
 * databases so the next spec starts clean, and how long that takes is a fact
 * about the browser and the machine, not a signal about the code.
 *
 * On CI the `workspace-tests` job reported `cy.then() timed out after waiting
 * 4000ms`, 2 of 18 specs, on a run that passed unchanged when re-run. Five
 * consecutive local runs of the same commit passed in 24-27s with every spec
 * under a second, so the trigger is load on the CI box rather than anything in
 * the suite — and a teardown that is merely slow should not be reported as a
 * failing test.
 *
 * This is not the timeout increase the issue warned against. That warning was
 * about raising a budget to hide a race in the thing under test. Nothing under
 * test is involved here.
 */
const TEARDOWN_TIMEOUT_MS = 30000;

/** How long one `deleteDatabase` is given before the suite says so out loud. */
const DELETE_TIMEOUT_MS = 5000;

/**
 * Deletes one database, and reports what actually happened.
 *
 * `onblocked` used to resolve exactly like `onsuccess`. Blocked means another
 * connection still holds the database and **the delete has not happened** —
 * resolving as though it had left the database in place for the next spec while
 * reporting a clean teardown. Nothing failed, so nothing was ever looked at.
 *
 * It still does not fail the run: a leftover database is a suite problem, and
 * turning it into a red build punishes the next person rather than the cause.
 * What changed is that it is no longer silent, and the outcome is returned so
 * the caller can say how many survived.
 */
function deleteDatabase(factory, name) {
  return new Promise((resolve) => {
    const request = factory.deleteDatabase(name);
    const settle = (outcome) => {
      window.clearTimeout(giveUp);
      resolve(outcome);
    };
    const giveUp = window.setTimeout(() => resolve('timed-out'), DELETE_TIMEOUT_MS);

    request.onsuccess = () => settle('deleted');
    request.onerror = () => settle('errored');
    // Deliberately distinct from success: see above.
    request.onblocked = () => settle('blocked');
  });
}

afterEach(() => cy.window({ log: false, timeout: TEARDOWN_TIMEOUT_MS }).then(
  { timeout: TEARDOWN_TIMEOUT_MS },
  (browserWindow) => {
    const factory = browserWindow.indexedDB;

    // `databases()` is how a spec's leftovers are found without the suite
    // having to remember its own names. Where a browser lacks it, the suite is
    // responsible for its own cleanup and says so.
    if (typeof factory.databases !== 'function') return undefined;

    return factory.databases()
      .then((open) => Promise.all(
        open.filter((entry) => entry.name).map((entry) => deleteDatabase(factory, entry.name))
      ))
      .then((outcomes) => {
        const survived = outcomes.filter((outcome) => outcome !== 'deleted');
        if (survived.length > 0) {
          // Visible, and not a failure. A database that outlives its spec makes
          // the next one start dirty, which is the failure mode this hook
          // exists to prevent — so it has to be sayable rather than swallowed.
          // eslint-disable-next-line no-console
          console.warn(
            `[cana] ${survived.length} database(s) survived teardown `
            + `(${survived.join(', ')}). The next spec starts with them present.`
          );
        }
        return undefined;
      });
  }
));
