import { render, screen, waitFor } from '@/test-utils';
import { MonacoCodeBlock } from './MonacoCodeBlock';
import { monacoTestState, resetMonacoTestState } from '../../test/mocks/monaco-editor';

/**
 * JUM-701 — the mount path, which no suite ran until now.
 *
 * `MonacoCodeBlock` checked `process.env.NODE_ENV === 'test'` and returned
 * before creating the editor, so every suite rendered a component that had
 * switched itself off: the accessibility audits only ever saw the `<pre>`
 * fallback, and the 23 "a11y failures" under `NODE_ENV=dev` were not
 * accessibility failures at all — they were `ReferenceError: define is not
 * defined`, from Jest resolving Monaco's AMD bundle under jsdom.
 *
 * The environment check is gone and Monaco is a double (`test/mocks`). These
 * assert what the mount produces, so removing the mount — or restoring the
 * environment branch — fails here rather than silently reducing what the other
 * suites audit.
 *
 * Monaco's own DOM is not in scope: the double does not build one. The real
 * editor is exercised by the Cypress suites, in a real browser.
 */
describe('MonacoCodeBlock mount (JUM-701)', () => {
  beforeEach(() => {
    resetMonacoTestState();
  });

  it('creates a model and an editor in the host element', async () => {
    expect.hasAssertions();

    render(<MonacoCodeBlock value="const answer = 42;" language="ts" testId="mount" />);

    await waitFor(() => expect(monacoTestState.editors).toHaveLength(1));

    const [model] = monacoTestState.models;
    const [editor] = monacoTestState.editors;

    expect(model.getValue()).toBe('const answer = 42;');
    // `ts` is an alias; the component normalises it before Monaco sees it.
    expect(model.language).toBe('typescript');
    expect(editor.host).toBe(screen.getByTestId('mount').querySelector('.jtx-monaco-code__editor'));
  });

  it('removes trailing blank lines before rendering code', async () => {
    expect.hasAssertions();

    render(<MonacoCodeBlock value={'const answer = 42;\n\n  \n'} language="ts" testId="trim" />);

    await waitFor(() => expect(monacoTestState.editors).toHaveLength(1));

    const [model] = monacoTestState.models;
    const fallback = screen
      .getByTestId('trim')
      .querySelector('.jtx-monaco-code__fallback code') as HTMLElement;

    expect(model.getValue()).toBe('const answer = 42;');
    expect(fallback.textContent).toBe('const answer = 42;');
  });

  it('hides the fallback once the editor is up', async () => {
    expect.hasAssertions();

    // The fallback is what a reader gets before the editor mounts, and what a
    // screen reader would get twice if it stayed exposed afterwards.
    render(<MonacoCodeBlock value="ok" testId="fallback" />);

    const fallback = screen
      .getByTestId('fallback')
      .querySelector('.jtx-monaco-code__fallback') as HTMLElement;

    expect(fallback.getAttribute('aria-hidden')).toBe('false');

    await waitFor(() => expect(fallback.getAttribute('aria-hidden')).toBe('true'));

    expect(fallback.getAttribute('data-mounted')).toBe('true');
  });

  it('applies the theme the document asks for', async () => {
    expect.hasAssertions();

    // The render helper pins the scheme to light before the first paint
    // (JUM-701), so this asserts the mapping rather than a race.
    render(<MonacoCodeBlock value="ok" testId="theme" />);

    // Only `setTheme` is asserted here: `defineThemes` guards itself with a
    // module-level flag, so the definitions land on the first mount in the
    // module's life and not on this one.
    await waitFor(() => expect(monacoTestState.activeTheme).toBe('jumentix-light'));
  });
});
