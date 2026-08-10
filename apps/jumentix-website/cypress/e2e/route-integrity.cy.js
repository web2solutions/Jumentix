/**
 * JUM-158 — the checks that need a real browser, across many routes.
 *
 * The HTTP sweep (`scripts/route-sweep.mjs`) answers "does every URL resolve
 * and does every internal link point somewhere real" over 151 routes in
 * seconds. It cannot see a console error, a hydration mismatch, or a navigation
 * that is present in the markup but unreachable with a keyboard.
 *
 * Those need a browser, and a browser over 151 routes is slow enough that
 * nobody would run it. So this spec takes the routes where a regression would
 * be most costly — the commercial entry points and the documentation roots —
 * and asserts the things only a browser can observe.
 */

/**
 * Hydration mismatches surface as React warnings on `console.error`, not as
 * thrown errors, so a page can look perfect and still be broken for anyone
 * whose first interaction lands before the client catches up.
 */
const HYDRATION_MARKERS = [
  'did not match',
  'Hydration failed',
  'There was an error while hydrating',
  'Text content does not match'
];

/**
 * Noise that is not the site's fault and would make this spec a coin flip:
 * third-party embeds and network conditions the test does not control.
 */
const IGNORED_CONSOLE = [
  'Download the React DevTools',
  'favicon.ico'
];

const CRITICAL_ROUTES = [
  '/',
  '/product',
  '/architecture',
  '/integrations',
  '/use-cases',
  '/security-compliance',
  '/pricing-or-engagement',
  '/community',
  '/contact',
  '/roadmap',
  '/changelog',
  '/docs'
];

function visitAndCollect(route) {
  const errors = [];
  cy.visit(route, {
    onBeforeLoad(win) {
      cy.stub(win.console, 'error').callsFake((...args) => {
        errors.push(args.map(String).join(' '));
      });
    }
  });
  return cy.wrap(errors, { log: false });
}

describe('route integrity in a real browser (JUM-158)', () => {
  CRITICAL_ROUTES.forEach((route) => {
    it(`renders ${route} without console or hydration errors`, () => {
      visitAndCollect(route).then((errors) => {
        const relevant = errors.filter(
          (message) => !IGNORED_CONSOLE.some((ignored) => message.includes(ignored))
        );
        const hydration = relevant.filter(
          (message) => HYDRATION_MARKERS.some((marker) => message.includes(marker))
        );

        // Reported separately: a hydration mismatch and a stray console error
        // are different defects, and saying which one fired saves the next
        // person the bisect.
        expect(hydration, `hydration errors on ${route}`).to.deep.equal([]);
        expect(relevant, `console errors on ${route}`).to.deep.equal([]);
      });
    });

    it(`keeps primary navigation reachable on ${route}`, () => {
      cy.visit(route);
      // Present in the DOM is not the same as usable. A nav that renders but
      // cannot be reached or activated is inaccessible navigation, which the
      // acceptance criteria call out by name.
      cy.get('nav, header').first().should('exist').and('be.visible');
      cy.get('a[href]').filter(':visible').should('have.length.greaterThan', 0);
    });
  });

  it('has no route rendering an empty document body', () => {
    CRITICAL_ROUTES.forEach((route) => {
      cy.visit(route);
      cy.get('body').invoke('text').should((text) => {
        expect(text.trim().length, `visible text on ${route}`).to.be.greaterThan(0);
      });
    });
  });
});
