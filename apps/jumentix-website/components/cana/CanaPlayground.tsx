'use client';

import { javascript } from '@codemirror/lang-javascript';
import { EditorState } from '@codemirror/state';
import { EditorView, basicSetup } from 'codemirror';
import { Alert, Button, Code, Group, Paper, Stack, Text, Title } from '@mantine/core';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { deleteEphemeralDatabase, runCanaSnippet } from './runSnippet';
import { getCanaSnippet } from './snippets';

export type CanaPlaygroundProps = {
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

export function CanaPlayground({ id = 'getting-started', code }: CanaPlaygroundProps) {
  const pathname = usePathname();
  const locale = resolveLocale(pathname);
  const snippet = getCanaSnippet(id);
  const initialCode = code ?? snippet?.code ?? '';
  const sessionId = useMemo(
    () => (typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID().slice(0, 8)
      : String(Date.now())),
    []
  );
  const dbName = `cana-docs-${id}-${sessionId}`;

  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [draft, setDraft] = useState(initialCode);
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState<string>('');
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
          if (update.docChanged) {
            setDraft(update.state.doc.toString());
          }
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
    // Re-mount editor when snippet identity changes; draft edits stay local.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, initialCode]);

  const labels = locale === 'pt-BR'
    ? {
        run: 'Executar',
        reset: 'Resetar',
        output: 'Resultado',
        logs: 'Console',
        db: 'Banco efêmero',
        missing: 'Snippet não encontrado.',
        title: snippet?.title['pt-BR'] ?? id,
        description: snippet?.description['pt-BR'] ?? ''
      }
    : {
        run: 'Run',
        reset: 'Reset',
        output: 'Result',
        logs: 'Console',
        db: 'Ephemeral database',
        missing: 'Snippet not found.',
        title: snippet?.title.en ?? id,
        description: snippet?.description.en ?? ''
      };

  async function handleRun() {
    setRunning(true);
    setError(null);
    setOutput('');
    setLogs([]);
    try {
      const cana = await import('@jumentix/cana');
      const source = viewRef.current?.state.doc.toString() ?? draft;
      const { result, logs: captured } = await runCanaSnippet(source, cana as unknown as Record<string, unknown>, dbName);
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
      await deleteEphemeralDatabase(dbName);
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
        <Code>{id}</Code>
      </Alert>
    );
  }

  return (
    <Paper withBorder p="md" my="md" data-testid={`cana-playground-${id}`}>
      <Stack gap="sm">
        <div>
          <Title order={4}>{labels.title}</Title>
          {labels.description ? (
            <Text size="sm" c="dimmed">{labels.description}</Text>
          ) : null}
          <Text size="xs" c="dimmed" mt={4}>
            {labels.db}: <Code>{dbName}</Code>
          </Text>
        </div>

        <div ref={hostRef} data-testid={`cana-playground-editor-${id}`} />

        <Group>
          <Button
            data-testid={`cana-playground-run-${id}`}
            onClick={() => void handleRun()}
            loading={running}
          >
            {labels.run}
          </Button>
          <Button
            data-testid={`cana-playground-reset-${id}`}
            variant="default"
            onClick={() => void handleReset()}
            disabled={running}
          >
            {labels.reset}
          </Button>
        </Group>

        {error ? (
          <Alert color="red" title="Error">
            <Code block>{error}</Code>
          </Alert>
        ) : null}

        {output ? (
          <Stack gap={4}>
            <Text fw={600} size="sm">{labels.output}</Text>
            <Code block data-testid={`cana-playground-output-${id}`}>{output}</Code>
          </Stack>
        ) : null}

        {logs.length > 0 ? (
          <Stack gap={4}>
            <Text fw={600} size="sm">{labels.logs}</Text>
            <Code block data-testid={`cana-playground-logs-${id}`}>
              {logs.join('\n')}
            </Code>
          </Stack>
        ) : null}
      </Stack>
    </Paper>
  );
}
