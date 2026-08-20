'use client';

import type * as Monaco from 'monaco-editor';
import type { CSSProperties, HTMLAttributes } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { trimTrailingBlankCodeLines } from './normalizeCode';

type MonacoApi = typeof Monaco;
type MonacoEditor = Monaco.editor.IStandaloneCodeEditor;
type MonacoModel = Monaco.editor.ITextModel;

export type MonacoCodeBlockProps = Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> & {
  value: string;
  language?: string;
  readOnly?: boolean;
  onChange?: (value: string) => void;
  minHeight?: number;
  maxHeight?: number;
  ariaLabel?: string;
  className?: string;
  testId?: string;
};

let themesDefined = false;

function getColorScheme(): 'light' | 'dark' {
  if (typeof document === 'undefined') return 'dark';
  return document.documentElement.getAttribute('data-mantine-color-scheme') === 'light'
    ? 'light'
    : 'dark';
}

function normalizeLanguage(language?: string): string {
  const normalized = (language ?? 'typescript')
    .replace(/^language-/, '')
    .replace(/^\./, '')
    .toLowerCase();

  const aliases: Record<string, string> = {
    bash: 'shell',
    cjs: 'javascript',
    env: 'shell',
    js: 'javascript',
    jsx: 'javascript',
    mjs: 'javascript',
    shellscript: 'shell',
    sh: 'shell',
    ts: 'typescript',
    tsx: 'typescript',
    yml: 'yaml'
  };

  return aliases[normalized] ?? normalized;
}

export function languageFromPath(path: string): string {
  const extension = path.split('.').pop() ?? '';
  return normalizeLanguage(extension);
}

function getEditorHeight(value: string, minHeight: number, maxHeight: number): number {
  const lines = value.split('\n').length;
  const naturalHeight = Math.max(minHeight, Math.min(maxHeight, lines * 20 + 28));
  return naturalHeight;
}

function configureWorkers() {
  if (typeof window === 'undefined') return;

  const root = window as typeof window & {
    MonacoEnvironment?: {
      jumentixConfigured?: boolean;
      getWorker?: (_moduleId: string, label: string) => Worker;
    };
  };

  if (root.MonacoEnvironment?.jumentixConfigured) return;

  root.MonacoEnvironment = {
    jumentixConfigured: true,
    getWorker: (_moduleId: string, label: string) => {
      if (label === 'json') {
        return new Worker(new URL('monaco-editor/language/json/json.worker', import.meta.url), {
          type: 'module'
        });
      }

      if (label === 'css' || label === 'scss' || label === 'less') {
        return new Worker(new URL('monaco-editor/language/css/css.worker', import.meta.url), {
          type: 'module'
        });
      }

      if (label === 'html' || label === 'handlebars' || label === 'razor') {
        return new Worker(new URL('monaco-editor/language/html/html.worker', import.meta.url), {
          type: 'module'
        });
      }

      if (label === 'typescript' || label === 'javascript') {
        return new Worker(new URL('monaco-editor/language/typescript/ts.worker', import.meta.url), {
          type: 'module'
        });
      }

      return new Worker(new URL('monaco-editor/editor/editor.worker', import.meta.url), {
        type: 'module'
      });
    }
  };
}

function defineThemes(monaco: MonacoApi) {
  if (themesDefined) return;
  themesDefined = true;

  monaco.editor.defineTheme('jumentix-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'keyword', foreground: '7dd3fc' },
      { token: 'string', foreground: '9be9a8' },
      { token: 'number', foreground: 'f7c97f' },
      { token: 'comment', foreground: '7b8da6', fontStyle: 'italic' }
    ],
    colors: {
      'editor.background': '#080d14',
      'editor.foreground': '#e8f0fb',
      'editor.lineHighlightBackground': '#16202d',
      'editorLineNumber.foreground': '#6f8097',
      'editorLineNumber.activeForeground': '#b8d9ff',
      'editor.selectionBackground': '#166bd566',
      'editor.inactiveSelectionBackground': '#2b384966',
      'editorCursor.foreground': '#2f88f5'
    }
  });

  monaco.editor.defineTheme('jumentix-light', {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'keyword', foreground: '1257ae' },
      { token: 'string', foreground: '087847' },
      { token: 'number', foreground: 'a32e1a' },
      { token: 'comment', foreground: '667085', fontStyle: 'italic' }
    ],
    colors: {
      'editor.background': '#fbfdff',
      'editor.foreground': '#142033',
      'editor.lineHighlightBackground': '#eff7ff',
      'editorLineNumber.foreground': '#8794a7',
      'editorLineNumber.activeForeground': '#1257ae',
      'editor.selectionBackground': '#b8d9ff',
      'editor.inactiveSelectionBackground': '#dce2ea',
      'editorCursor.foreground': '#166bd5'
    }
  });
}

export function MonacoCodeBlock({
  value,
  language,
  readOnly = true,
  onChange,
  minHeight = 120,
  maxHeight = Number.POSITIVE_INFINITY,
  ariaLabel,
  className,
  testId,
  ...rootProps
}: MonacoCodeBlockProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const monacoRef = useRef<MonacoApi | null>(null);
  const editorRef = useRef<MonacoEditor | null>(null);
  const modelRef = useRef<MonacoModel | null>(null);
  /*
   * The fallback's visibility is a DOM fact, not React state (JUM-701).
   *
   * It used to be `useState`, set when the editor finished mounting. That is a
   * state update from a promise nothing in a test awaits, which React reports
   * as an update outside `act` — 108 of them once the mount stopped being
   * skipped under `NODE_ENV=test`. Writing the attributes through the ref keeps
   * the rendered DOM identical and takes a render pass out of the mount.
   */
  const fallbackRef = useRef<HTMLPreElement | null>(null);

  const markMounted = (isMounted: boolean) => {
    const fallback = fallbackRef.current;
    if (!fallback) return;
    fallback.setAttribute('aria-hidden', isMounted ? 'true' : 'false');
    fallback.setAttribute('data-mounted', isMounted ? 'true' : 'false');
  };
  const [scheme, setScheme] = useState<'light' | 'dark'>(getColorScheme);
  const schemeRef = useRef(scheme);
  const normalizedLanguage = useMemo(() => normalizeLanguage(language), [language]);
  const normalizedValue = useMemo(() => trimTrailingBlankCodeLines(value), [value]);
  const dataTestId = testId ?? (rootProps as { 'data-testid'?: string })['data-testid'];
  const height = useMemo(
    () => getEditorHeight(normalizedValue, minHeight, maxHeight),
    [maxHeight, minHeight, normalizedValue]
  );

  useEffect(() => {
    // A capability check, not an environment check. `NODE_ENV === 'test'` used
    // to be part of this condition, which made the component behave one way for
    // its tests and another for its users (JUM-701).
    if (typeof MutationObserver === 'undefined') return undefined;
    // Only dispatch when the scheme actually changed. Mantine writes the
    // attribute on first paint with the value already in place, and React warns
    // about the dispatch itself — an updater that returns the same value still
    // counts as an update outside `act` (JUM-701).
    const observer = new MutationObserver(() => {
      const next = getColorScheme();
      if (next === schemeRef.current) return;
      schemeRef.current = next;
      setScheme(next);
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-mantine-color-scheme']
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function mountEditor() {
      if (!hostRef.current) return;
      configureWorkers();
      const monaco = await import('monaco-editor');
      if (cancelled || !hostRef.current) return;

      defineThemes(monaco);
      monaco.editor.setTheme(scheme === 'dark' ? 'jumentix-dark' : 'jumentix-light');

      const model = monaco.editor.createModel(normalizedValue, normalizedLanguage);
      const editor = monaco.editor.create(hostRef.current, {
        model,
        automaticLayout: true,
        contextmenu: false,
        domReadOnly: readOnly,
        fontFamily: 'var(--jtx-font-mono)',
        fontLigatures: false,
        fontSize: 13,
        lineHeight: 20,
        lineNumbersMinChars: 3,
        minimap: { enabled: false },
        padding: { top: 12, bottom: 12 },
        readOnly,
        renderLineHighlight: readOnly ? 'none' : 'line',
        scrollBeyondLastLine: false,
        scrollbar: {
          alwaysConsumeMouseWheel: true,
          horizontalScrollbarSize: 8,
          verticalScrollbarSize: 8
        },
        tabSize: 2,
        theme: scheme === 'dark' ? 'jumentix-dark' : 'jumentix-light',
        wordWrap: 'on'
      });

      if (onChange) {
        editor.onDidChangeModelContent(() => onChange(trimTrailingBlankCodeLines(model.getValue())));
      }

      monacoRef.current = monaco;
      modelRef.current = model;
      editorRef.current = editor;
      markMounted(true);
    }

    void mountEditor();

    return () => {
      cancelled = true;
      editorRef.current?.dispose();
      modelRef.current?.dispose();
      editorRef.current = null;
      modelRef.current = null;
      monacoRef.current = null;
      markMounted(false);
    };
    // The editor is mounted once; later prop updates are synchronized below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const model = modelRef.current;
    if (!model || model.getValue() === normalizedValue) return;
    model.setValue(normalizedValue);
    editorRef.current?.layout();
  }, [normalizedValue]);

  useEffect(() => {
    const monaco = monacoRef.current;
    const model = modelRef.current;
    if (!monaco || !model) return;
    monaco.editor.setModelLanguage(model, normalizedLanguage);
  }, [normalizedLanguage]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.updateOptions({
      domReadOnly: readOnly,
      readOnly,
      renderLineHighlight: readOnly ? 'none' : 'line'
    });
  }, [readOnly]);

  useEffect(() => {
    const monaco = monacoRef.current;
    if (!monaco) return;
    monaco.editor.setTheme(scheme === 'dark' ? 'jumentix-dark' : 'jumentix-light');
  }, [scheme]);

  useEffect(() => {
    editorRef.current?.layout();
  }, [height]);

  return (
    <div
      {...rootProps}
      className={['jtx-monaco-code', className].filter(Boolean).join(' ')}
      data-language={normalizedLanguage}
      data-testid={dataTestId}
      style={{
        ...rootProps.style,
        '--jtx-monaco-height': `${height}px`
      } as CSSProperties}
    >
      <div
        ref={hostRef}
        className="jtx-monaco-code__editor"
        role="region"
        aria-label={ariaLabel ?? `${normalizedLanguage} code`}
      />
      <pre
        ref={fallbackRef}
        className="jtx-monaco-code__fallback"
        aria-hidden="false"
        data-mounted="false"
      >
        <code data-language={normalizedLanguage}>{normalizedValue}</code>
      </pre>
    </div>
  );
}
