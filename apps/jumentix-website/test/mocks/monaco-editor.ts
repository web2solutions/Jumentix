/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * A jsdom stand-in for `monaco-editor` (JUM-701).
 *
 * **This is a double, and it is here because the real thing cannot run.** Jest
 * resolves `monaco-editor` to its AMD bundle (`min/vs/index.js`), which calls
 * `define` at load and throws `ReferenceError: define is not defined` under
 * jsdom. Even resolving the ESM entry would not help: Monaco measures text with
 * canvas APIs jsdom does not implement.
 *
 * What it buys is that the mount path **runs**. Until now `MonacoCodeBlock`
 * checked `process.env.NODE_ENV === 'test'` and returned early, so every suite
 * rendered a component that had switched itself off — the editor was never
 * created, `mounted` stayed false, and the accessibility audits only ever saw
 * the `<pre>` fallback. A component that behaves differently because it is
 * being tested is the thing Requirement 135 exists to stop.
 *
 * What it does **not** cover, stated rather than implied (Requirement 135 §7):
 * Monaco's own DOM — its textarea, its ARIA wiring, its scrollbars. Those are
 * audited against a real browser by `cypress/e2e/docs-routes.cy.js` and
 * `commercial-routes.cy.js`. Nothing in jsdom can stand in for that.
 */
type Listener = () => void;

export type MockModel = {
  getValue: () => string;
  setValue: (next: string) => void;
  dispose: () => void;
  language: string;
};

export type MockEditor = {
  onDidChangeModelContent: (listener: Listener) => { dispose: () => void };
  updateOptions: (options: Record<string, unknown>) => void;
  layout: () => void;
  dispose: () => void;
  getModel: () => MockModel;
  options: Record<string, unknown>;
  host: HTMLElement;
};

/** Everything created during a test, so a suite can assert on the mount. */
export const monacoTestState: {
  models: MockModel[];
  editors: MockEditor[];
  themes: string[];
  activeTheme: string | null;
} = {
  models: [],
  editors: [],
  themes: [],
  activeTheme: null
};

export function resetMonacoTestState(): void {
  monacoTestState.models = [];
  monacoTestState.editors = [];
  monacoTestState.themes = [];
  monacoTestState.activeTheme = null;
}

function createModel(value: string, language: string): MockModel {
  let current = value;
  const model: MockModel = {
    getValue: () => current,
    setValue: (next: string) => { current = next; },
    dispose: () => {},
    language
  };
  monacoTestState.models.push(model);
  return model;
}

function create(host: HTMLElement, options: Record<string, unknown>): MockEditor {
  const listeners: Listener[] = [];
  const editor: MockEditor = {
    onDidChangeModelContent: (listener: Listener) => {
      listeners.push(listener);
      return { dispose: () => {} };
    },
    updateOptions: (next: Record<string, unknown>) => Object.assign(editor.options, next),
    layout: () => {},
    dispose: () => {},
    getModel: () => options.model as MockModel,
    options: { ...options },
    host
  };
  monacoTestState.editors.push(editor);
  return editor;
}

export const editor = {
  create,
  createModel,
  defineTheme: (name: string) => { monacoTestState.themes.push(name); },
  setTheme: (name: string) => { monacoTestState.activeTheme = name; },
  setModelLanguage: (model: MockModel, language: string) => {
    // eslint-disable-next-line no-param-reassign
    model.language = language;
  }
};

export default { editor };
