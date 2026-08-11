'use client';

import { javascript } from '@codemirror/lang-javascript';
import { EditorState } from '@codemirror/state';
import { EditorView, basicSetup } from 'codemirror';
import { Alert, Button, Code, Group, Paper, Stack, Text, Title } from '@mantine/core';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getDocsSnippet } from './catalogs';
import { runDocsSnippet } from './runSnippet';
import { getRuntime } from './runtimes';
import type { DocsRuntimeId } from './types';

export type DocsPlaygroundProps = {
  runtime: DocsRuntimeId;
  id?: string;
  code?: string;
};

type Locale = 'en' | 'pt-BR';

function resolveLocale(pathname: string | null): Locale {
  return pathname?.includes('/pt-BR/') ? 'pt-BR' : 'en';
}

function formatOutput(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function DocsPlayground({
  runtime,
  id = 'getting-started',
  code
}: DocsPlaygroundProps) {
  const pathname = usePathname();
  const locale = resolveLocale(pathname);
  const snippet = getDocsSnippet(runtime, id);
  const initialCode = code ?? snippet?.code ?? '';
  const sessionKey = useMemo(
    () => `${id}-${typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID().slice(0, 8)
      : String(Date.now())}`,
    [id]
  );

  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const resetRef = useRef<(() => Promise<void>) | undefined>(undefined);
  const [draft, setDraft] = useState(initialCode);
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(initialCode);
  }, [initialCode]);

  useEffect(() => {
    if (!hostRef.current) return undefined;
    const state = EditorState.create({
      doc: draft,
      extensions: [
        basicSetup,
        javascript(),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) setDraft(update.state.doc.toString());
        }),
        EditorView.theme({
          '&': { fontSize: '13px', maxHeight: '320px' },
          '.cm-scroller': { overflow: 'auto' }
        })
      ]
    });
    const view = new EditorView({ state, parent: hostRef.current });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runtime, id, initialCode]);

  const labels = locale === 'pt-BR'
    ? {
        run: 'Executar',
        reset: 'Resetar',
        output: 'Resultado',
        logs: 'Console',
        staticCode: 'Código (cópia para agentes/LLM)',
        missing: 'Snippet não encontrado.',
        title: snippet?.title['pt-BR'] ?? id,
        description: snippet?.description['pt-BR'] ?? ''
      }
    : {
        run: 'Run',
        reset: 'Reset',
        output: 'Result',
        logs: 'Console',
        staticCode: 'Code (copy for agents/LLMs)',
        missing: 'Snippet not found.',
        title: snippet?.title.en ?? id,
        description: snippet?.description.en ?? ''
      };

  const testId = `docs-playground-${runtime}-${id}`;
  const canaCompat = runtime === 'cana';

  async function handleRun() {
    setRunning(true);
    setError(null);
    setOutput('');
    setLogs([]);
    try {
      const rt = getRuntime(runtime);
      const loaded = await rt.load(sessionKey);
      resetRef.current = loaded.reset;
      const source = viewRef.current?.state.doc.toString() ?? draft;
      const { result, logs: captured } = await runDocsSnippet(
        source,
        rt.apiGlobalName,
        loaded.api,
        loaded.extras ?? {}
      );
      setLogs(captured);
      setOutput(formatOutput(result));
    } catch (err) {
      setError(formatOutput(err));
    } finally {
      setRunning(false);
    }
  }

  async function handleReset() {
    setRunning(true);
    setError(null);
    setOutput('');
    setLogs([]);
    try {
      if (resetRef.current) await resetRef.current();
      setDraft(initialCode);
      if (viewRef.current) {
        viewRef.current.dispatch({
          changes: {
            from: 0,
            to: viewRef.current.state.doc.length,
            insert: initialCode
          }
        });
      }
    } catch (err) {
      setError(formatOutput(err));
    } finally {
      setRunning(false);
    }
  }

  if (!snippet && !code) {
    return (
      <Alert color="red" my="md" title={labels.missing}>
        <Code>{runtime}/{id}</Code>
      </Alert>
    );
  }

  return (
    <Paper
      withBorder
      p="md"
      my="md"
      data-testid={testId}
      {...(canaCompat ? { 'data-testid-cana': `cana-playground-${id}` } : {})}
    >
      <Stack gap="sm">
        <div>
          <Title order={4}>{labels.title}</Title>
          {labels.description ? (
            <Text size="sm" c="dimmed">{labels.description}</Text>
          ) : null}
        </div>

        <Stack gap={4}>
          <Text fw={600} size="sm">{labels.staticCode}</Text>
          <Code block data-testid={`${testId}-static`}>{initialCode}</Code>
        </Stack>

        <div
          ref={hostRef}
          data-testid={`${testId}-editor`}
          {...(canaCompat ? { 'data-cana-editor': `cana-playground-editor-${id}` } : {})}
        />

        <Group>
          <Button
            data-testid={`${testId}-run`}
            {...(canaCompat ? { 'data-cana-run': `cana-playground-run-${id}` } : {})}
            id={canaCompat ? `cana-playground-run-${id}` : undefined}
            onClick={() => void handleRun()}
            loading={running}
          >
            {labels.run}
          </Button>
          <Button
            data-testid={`${testId}-reset`}
            variant="default"
            onClick={() => void handleReset()}
            disabled={running}
          >
            {labels.reset}
          </Button>
        </Group>

        {/* Backward-compat hooks for existing Cypress selectors */}
        {canaCompat ? (
          <>
            <span data-testid={`cana-playground-${id}`} style={{ display: 'none' }} />
            <button
              type="button"
              data-testid={`cana-playground-run-${id}`}
              style={{ display: 'none' }}
              onClick={() => void handleRun()}
            />
            <button
              type="button"
              data-testid={`cana-playground-reset-${id}`}
              style={{ display: 'none' }}
              onClick={() => void handleReset()}
            />
          </>
        ) : null}

        {error ? (
          <Alert color="red" title="Error">
            <Code block>{error}</Code>
          </Alert>
        ) : null}

        {output ? (
          <Stack gap={4}>
            <Text fw={600} size="sm">{labels.output}</Text>
            <Code
              block
              data-testid={`${testId}-output`}
              {...(canaCompat ? { 'data-testid-alias': `cana-playground-output-${id}` } : {})}
            >
              {output}
            </Code>
            {canaCompat ? (
              <Code block data-testid={`cana-playground-output-${id}`} style={{ display: 'none' }}>
                {output}
              </Code>
            ) : null}
          </Stack>
        ) : null}

        {logs.length > 0 ? (
          <Stack gap={4}>
            <Text fw={600} size="sm">{labels.logs}</Text>
            <Code block data-testid={`${testId}-logs`}>{logs.join('\n')}</Code>
          </Stack>
        ) : null}
      </Stack>
    </Paper>
  );
}
