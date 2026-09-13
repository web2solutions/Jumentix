import { GlobalRegistrator } from '@happy-dom/global-registrator';

/**
 * One DOM per test process (JUM-776). `window`, `document`, `localStorage`
 * and `navigator` come from happy-dom so `@vue/test-utils` can mount real
 * single-file components — no stubs of CoreUI, no fake libraries
 * (Requirement 112 §4 spirit: verify what ships).
 */
if (typeof (globalThis as { document?: unknown }).document === 'undefined') {
  GlobalRegistrator.register({ url: 'http://localhost:3001/' });
}
