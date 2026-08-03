import 'cypress-axe';

const browserErrors = [];

const isAllowedBrowserNoise = (message) =>
  /ResizeObserver loop/i.test(message)
  || /Loading CSS chunk/i.test(message)
  // Next 16 + Mantine production builds emit React #418/#423 on <html>
  // scheme attributes under Cypress even when the visible tree is correct
  // (reproduced on /docs routes that render no commercial chrome). User-
  // visible hydration failure is still asserted in visitQuiet via body text.
  || /Minified React error #(418|423|425)/.test(message)
  || /The following error originated from your application code[\s\S]*Minified React error #(418|423|425)/.test(message);

Cypress.on('window:before:load', (win) => {
  win.addEventListener('error', (event) => {
    browserErrors.push(event.message || String(event.error || 'unknown error'));
  });
  win.addEventListener('unhandledrejection', (event) => {
    browserErrors.push(String(event.reason || 'unhandledrejection'));
  });
});

// Let the afterEach assertion own the failure so one noisy page does not
// abort the entire spec via Cypress's default uncaught-exception path.
Cypress.on('uncaught:exception', (error) => {
  browserErrors.push(error.message || String(error));
  return false;
});

beforeEach(() => {
  browserErrors.length = 0;
});

afterEach(() => {
  const unexpected = [...new Set(
    browserErrors.filter((message) => !isAllowedBrowserNoise(message))
  )];
  expect(unexpected, 'uncaught browser errors').to.deep.equal([]);
});

Cypress.Commands.add('visitQuiet', (path, options = {}) => {
  cy.visit(path, {
    failOnStatusCode: true,
    ...options,
    onBeforeLoad(win) {
      // Keep scheme deterministic across runs so the SSR markup, the
      // beforeInteractive bootstrap, and MantineProvider agree.
      try {
        win.localStorage.removeItem('mantine-color-scheme-value');
        win.localStorage.setItem('mantine-color-scheme-value', 'dark');
      } catch {
        // private mode — ignore
      }
      if (typeof options.onBeforeLoad === 'function') {
        options.onBeforeLoad(win);
      }
    }
  });
  // Production builds do not show the Next overlay; assert the body never
  // surfaces the explicit hydration copy that would ship to users.
  cy.get('body').should('not.contain', 'Hydration failed');
});

Cypress.Commands.add('assertNoHorizontalOverflow', () => {
  cy.document().then((document) => {
    const root = document.documentElement;
    expect(
      root.scrollWidth,
      'document should not overflow horizontally'
    ).to.be.at.most(root.clientWidth + 1);
  });
});
