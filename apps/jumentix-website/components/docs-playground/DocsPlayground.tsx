'use client';

import { Alert, Button, Group, Paper, Stack, Text, Title } from '@mantine/core';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { MonacoCodeBlock } from '../code/MonacoCodeBlock';
import { trimTrailingBlankCodeLines } from '../code/normalizeCode';
import { getDocsSnippet } from './catalogs';
import { runDocsSnippet } from './runSnippet';
import { getRuntime } from './runtimes';
import type { DocsRuntimeId } from './types';
import classes from './DocsPlayground.module.css';
import { docsPlaygroundAnchor } from './anchors';

export type DocsPlaygroundProps = {
  runtime: DocsRuntimeId;
  id?: string;
  code?: string;
};

type Locale = 'en' | 'pt-BR';
type BulkDlqOutput = {
  attemptedBulkCount?: number;
  createdDuringBulk?: number;
  rejectedToDeadLetterQueue?: number;
  finalTaskCount?: number;
  replayReport?: { replayed?: string[] };
  requestTimeline?: BulkDlqTimelineEntry[];
  timeline?: BulkDlqTimelineEntry[];
};
type BulkDlqTimelineEntry = {
  step?: string;
  taskId?: string;
  recordId?: string;
  source?: string;
  categoryId?: string;
};
type BulkDlqFlowKind = 'submitted' | 'accepted' | 'rejected' | 'replay' | 'retry';
type BulkDlqFlowEvent = {
  key: string;
  kind: BulkDlqFlowKind;
  taskId: string;
  label: string;
};
type BulkDlqFlowState = {
  attempted: number;
  accepted: number;
  rejected: number;
  replayed: number;
  finalTaskCount: number;
  events: BulkDlqFlowEvent[];
  hasRun: boolean;
};

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

function agentMarkdownForCode(title: string, source: string): string {
  return [
    `### ${title}`,
    '',
    '```ts',
    trimTrailingBlankCodeLines(source),
    '```'
  ].join('\n');
}

function parseBulkDlqOutput(output: string): BulkDlqOutput | null {
  if (!output) return null;
  try {
    const parsed = JSON.parse(output) as BulkDlqOutput;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function uniqueCount(values: string[]): number {
  return new Set(values.filter(Boolean)).size;
}

function buildBulkDlqFlowState(metrics: BulkDlqOutput | null): BulkDlqFlowState {
  const timeline = Array.isArray(metrics?.requestTimeline)
    ? metrics.requestTimeline
    : Array.isArray(metrics?.timeline)
      ? metrics.timeline
      : [];
  const events: BulkDlqFlowEvent[] = [];

  for (const [index, entry] of timeline.entries()) {
    const taskId = entry.taskId ?? entry.recordId ?? `request-${index + 1}`;
    if (entry.step === 'controller-create') {
      events.push({
        key: `${index}-submitted-${taskId}`,
        kind: 'submitted',
        taskId,
        label: `submit ${taskId}`,
      });
    }
    if (entry.step === 'lock-acquired') {
      events.push({
        key: `${index}-accepted-${taskId}`,
        kind: 'accepted',
        taskId,
        label: `store ${taskId}`,
      });
    }
    if (entry.step === 'dead-letter-listener-received') {
      events.push({
        key: `${index}-rejected-${taskId}`,
        kind: 'rejected',
        taskId,
        label: `reject ${taskId}`,
      });
    }
    if (entry.step === 'controller-replay') {
      events.push({
        key: `${index}-replay-${taskId}`,
        kind: 'replay',
        taskId,
        label: `replay ${taskId}`,
      });
      events.push({
        key: `${index}-retry-${taskId}`,
        kind: 'retry',
        taskId,
        label: `retry ${taskId}`,
      });
    }
  }

  const attemptedFromTimeline = uniqueCount(
    timeline
      .filter((entry) => entry.step === 'controller-create')
      .map((entry) => entry.taskId ?? '')
  );
  const acceptedFromTimeline = uniqueCount(
    timeline
      .filter((entry) => entry.step === 'lock-acquired')
      .map((entry) => entry.taskId ?? '')
  );
  const rejectedFromTimeline = uniqueCount(
    timeline
      .filter((entry) => entry.step === 'dead-letter-listener-received')
      .map((entry) => entry.taskId ?? '')
  );
  const replayedFromTimeline = uniqueCount(
    timeline
      .filter((entry) => entry.step === 'controller-replay')
      .map((entry) => entry.taskId ?? '')
  );

  return {
    attempted: metrics?.attemptedBulkCount ?? attemptedFromTimeline,
    accepted: metrics?.createdDuringBulk ?? acceptedFromTimeline,
    rejected: metrics?.rejectedToDeadLetterQueue ?? rejectedFromTimeline,
    replayed: metrics?.replayReport?.replayed?.length ?? replayedFromTimeline,
    finalTaskCount: metrics?.finalTaskCount ?? acceptedFromTimeline,
    events,
    hasRun: Boolean(metrics),
  };
}

function BulkDeadLetterFlowCanvas({
  output,
  running,
  locale,
  testId,
}: {
  output: string;
  running: boolean;
  locale: Locale;
  testId: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const metrics = useMemo(() => parseBulkDlqOutput(output), [output]);
  const flowState = useMemo(() => buildBulkDlqFlowState(metrics), [metrics]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (navigator.userAgent.includes('jsdom')) return undefined;
    let context: CanvasRenderingContext2D | null = null;
    try {
      context = canvas?.getContext('2d') ?? null;
    } catch {
      context = null;
    }
    if (!canvas || !context) return undefined;

    let frameId = 0;
    const nodes = [
      { id: 'controller', label: 'Controller', x: 82, y: 88 },
      { id: 'mutex', label: 'Mutex', x: 250, y: 88 },
      { id: 'store', label: 'Task Store', x: 430, y: 88 },
      { id: 'dlq', label: 'DLQ', x: 250, y: 205 },
      { id: 'replay', label: 'Replay Controller', x: 430, y: 205 },
    ];
    const flowRoutes: Record<BulkDlqFlowKind, {
      from: { x: number; y: number };
      to: { x: number; y: number };
      color: string;
      label: string;
    }> = {
      submitted: { from: nodes[0], to: nodes[1], color: '#2563eb', label: 'bulk request' },
      accepted: { from: nodes[1], to: nodes[2], color: '#16a34a', label: 'lock acquired' },
      rejected: { from: nodes[1], to: nodes[3], color: '#dc2626', label: 'lock rejected' },
      replay: { from: nodes[3], to: nodes[4], color: '#ea580c', label: 'dlq replay' },
      retry: { from: nodes[4], to: nodes[1], color: '#ea580c', label: 'controller retry' },
    };
    const activeKinds = new Set(flowState.events.map((event) => event.kind));

    const resize = () => {
      const ratio = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      canvas.width = Math.max(1, Math.floor(width * ratio));
      canvas.height = Math.max(1, Math.floor(height * ratio));
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    const drawArrow = (
      from: { x: number; y: number },
      to: { x: number; y: number },
      color: string,
      active: boolean
    ) => {
      const headLength = 9;
      const angle = Math.atan2(to.y - from.y, to.x - from.x);
      context.strokeStyle = color;
      context.fillStyle = color;
      context.globalAlpha = active ? 0.92 : 0.3;
      context.lineWidth = active ? 3 : 2;
      context.beginPath();
      context.moveTo(from.x, from.y);
      context.lineTo(to.x, to.y);
      context.stroke();
      context.beginPath();
      context.moveTo(to.x, to.y);
      context.lineTo(
        to.x - headLength * Math.cos(angle - Math.PI / 6),
        to.y - headLength * Math.sin(angle - Math.PI / 6)
      );
      context.lineTo(
        to.x - headLength * Math.cos(angle + Math.PI / 6),
        to.y - headLength * Math.sin(angle + Math.PI / 6)
      );
      context.closePath();
      context.fill();
      context.globalAlpha = 1;
    };

    const draw = (time: number) => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      context.clearRect(0, 0, width, height);
      context.fillStyle = '#07111f';
      context.fillRect(0, 0, width, height);

      context.font = '700 12px system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
      Object.entries(flowRoutes).forEach(([kind, flow]) => {
        const active = activeKinds.has(kind as BulkDlqFlowKind);
        drawArrow(flow.from, flow.to, flow.color, active);
        context.globalAlpha = active ? 0.75 : 0.32;
        context.fillStyle = flow.color;
        context.fillText(flow.label, (flow.from.x + flow.to.x) / 2 - 34, (flow.from.y + flow.to.y) / 2 - 10);
        context.globalAlpha = 1;
      });

      nodes.forEach((node) => {
        context.fillStyle = node.id === 'dlq' ? '#220b0b' : '#0f1b2d';
        context.strokeStyle = node.id === 'dlq' ? '#dc2626' : '#334155';
        context.lineWidth = node.id === 'dlq' ? 3 : 1.5;
        context.beginPath();
        context.roundRect(node.x - 58, node.y - 24, 116, 48, 9);
        context.fill();
        context.stroke();
        context.fillStyle = '#e2e8f0';
        context.textAlign = 'center';
        context.fillText(node.label, node.x, node.y + 4);
      });

      flowState.events.forEach((event, index) => {
        const route = flowRoutes[event.kind];
        const progress = ((time / 1500 + index / Math.max(flowState.events.length, 1)) % 1);
        const pulseX = route.from.x + (route.to.x - route.from.x) * progress;
        const pulseY = route.from.y + (route.to.y - route.from.y) * progress;
        const isRejected = event.kind === 'rejected';
        context.globalAlpha = isRejected ? 0.98 : 0.86;
        context.fillStyle = route.color;
        context.beginPath();
        context.arc(pulseX, pulseY, isRejected ? 6.75 : 5.25, 0, Math.PI * 2);
        context.fill();
        context.globalAlpha = 0.9;
        context.fillStyle = '#e2e8f0';
        context.fillText(event.taskId, pulseX + 8, pulseY - 8);
        context.globalAlpha = 1;
      });

      context.textAlign = 'left';
      context.fillStyle = '#e2e8f0';
      context.font = '800 13px system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
      context.fillText(`attempted: ${flowState.attempted}`, 18, height - 46);
      context.fillStyle = '#bbf7d0';
      context.fillText(`accepted in bulk: ${flowState.accepted}`, 128, height - 46);
      context.fillStyle = '#fecaca';
      context.fillText(`rejected by lock: ${flowState.rejected}`, 285, height - 46);
      context.fillStyle = '#fed7aa';
      context.fillText(`replayed: ${flowState.replayed}`, 18, height - 24);
      context.fillStyle = '#e2e8f0';
      context.fillText(`final tasks: ${flowState.finalTaskCount}`, 128, height - 24);

      if (!flowState.hasRun) {
        context.fillStyle = running ? '#bfdbfe' : '#94a3b8';
        context.font = '800 14px system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
        context.fillText(
          running ? 'executing playground code...' : 'run the playground to capture real request flow',
          18,
          28
        );
      }

      frameId = window.requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener('resize', resize);
    frameId = window.requestAnimationFrame(draw);
    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', resize);
    };
  }, [flowState, running]);

  return (
    <section className={classes.flowPanel} aria-label={locale === 'pt-BR' ? 'Fluxo visual de mutex e DLQ' : 'Mutex and DLQ visual flow'}>
      <div>
        <Title order={5}>
          {locale === 'pt-BR' ? 'Fluxo em tempo real' : 'Live data flow'}
        </Title>
        <Text size="sm" c="dimmed">
          {locale === 'pt-BR'
            ? 'Fluxos rejeitados pelo lock aparecem em vermelho e entram na DLQ antes do replay pelo controller.'
            : 'Lock-rejected data flows are red and move into the DLQ before controller-level replay.'}
        </Text>
      </div>
      <canvas
        ref={canvasRef}
        className={classes.flowCanvas}
        role="img"
        aria-label={locale === 'pt-BR'
          ? 'Canvas mostrando requests aceitos, requests rejeitados pelo lock em vermelho, DLQ e replay'
          : 'Canvas showing accepted requests, lock-rejected requests in red, DLQ, and replay'}
        data-testid={`${testId}-flow-canvas`}
      />
      <div className={classes.flowLegend}>
        <span><i data-tone="accepted" />{locale === 'pt-BR' ? 'Aceito' : 'Accepted'}</span>
        <span><i data-tone="rejected" />{locale === 'pt-BR' ? 'Rejeitado pelo lock' : 'Rejected by lock'}</span>
        <span><i data-tone="replay" />Replay</span>
      </div>
      <div className={classes.flowStats} data-testid={`${testId}-flow-state`}>
        <span>{locale === 'pt-BR' ? 'Tentadas' : 'Attempted'}: {flowState.attempted}</span>
        <span>{locale === 'pt-BR' ? 'Aceitas no bulk' : 'Accepted in bulk'}: {flowState.accepted}</span>
        <span>{locale === 'pt-BR' ? 'Rejeitadas pelo lock' : 'Rejected by lock'}: {flowState.rejected}</span>
        <span>{locale === 'pt-BR' ? 'Reprocessadas' : 'Replayed'}: {flowState.replayed}</span>
        <span>{locale === 'pt-BR' ? 'Tasks finais' : 'Final tasks'}: {flowState.finalTaskCount}</span>
        <span>{locale === 'pt-BR' ? 'Eventos reais' : 'Real events'}: {flowState.events.length}</span>
      </div>
    </section>
  );
}

export function DocsPlayground({
  runtime,
  id = 'getting-started',
  code
}: DocsPlaygroundProps) {
  const pathname = usePathname();
  const locale = resolveLocale(pathname);
  const snippet = getDocsSnippet(runtime, id);
  const initialCode = trimTrailingBlankCodeLines(code ?? snippet?.code ?? '');
  const sessionKey = useMemo(
    () => `${id}-${typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID().slice(0, 8)
      : String(Date.now())}`,
    [id]
  );

  const resetRef = useRef<(() => Promise<void>) | undefined>(undefined);
  const [draft, setDraft] = useState(initialCode);
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(initialCode);
  }, [initialCode]);

  const labels = locale === 'pt-BR'
    ? {
        run: 'Executar',
        reset: 'Resetar',
        output: 'Resultado',
        logs: 'Console',
        missing: 'Snippet não encontrado.',
        title: snippet?.title['pt-BR'] ?? id,
        description: snippet?.description['pt-BR'] ?? ''
      }
    : {
        run: 'Run',
        reset: 'Reset',
        output: 'Result',
        logs: 'Console',
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
      const source = trimTrailingBlankCodeLines(draft);
      if (source !== draft) setDraft(source);
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
      setDraft(trimTrailingBlankCodeLines(initialCode));
    } catch (err) {
      setError(formatOutput(err));
    } finally {
      setRunning(false);
    }
  }

  if (!snippet && !code) {
    return (
      <Alert color="red" my="md" title={labels.missing}>
        <Text component="code" className="jtx-inline-code">{runtime}/{id}</Text>
      </Alert>
    );
  }

  return (
    <Paper
      id={docsPlaygroundAnchor(runtime, id)}
      withBorder
      p="md"
      my="md"
      style={{ scrollMarginTop: 96 }}
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

        <pre
          hidden
          data-agent-markdown="docs-playground-static-code"
          data-testid={`${testId}-static`}
        >
          {agentMarkdownForCode(labels.title, initialCode)}
        </pre>

        <MonacoCodeBlock
          value={draft}
          language="typescript"
          readOnly={false}
          onChange={setDraft}
          minHeight={200}
          maxHeight={420}
          ariaLabel={`${labels.title} editable playground code`}
          testId={`${testId}-editor`}
          {...(canaCompat ? { 'data-cana-editor': `cana-playground-editor-${id}` } : {})}
        />

        {runtime === 'jumentix-browser-lab' && id === 'bulk-mutex-dead-letter' ? (
          <BulkDeadLetterFlowCanvas
            output={output}
            running={running}
            locale={locale}
            testId={testId}
          />
        ) : null}

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
            <MonacoCodeBlock value={error} language="text" readOnly minHeight={100} maxHeight={260} />
          </Alert>
        ) : null}

        {output ? (
          <Stack gap={4}>
            <Text fw={600} size="sm">{labels.output}</Text>
            <MonacoCodeBlock
              value={output}
              language="json"
              readOnly
              minHeight={120}
              maxHeight={320}
              ariaLabel={`${labels.title} output`}
              testId={`${testId}-output`}
              {...(canaCompat ? { 'data-testid-alias': `cana-playground-output-${id}` } : {})}
            />
            {canaCompat ? (
              <span data-testid={`cana-playground-output-${id}`} style={{ display: 'none' }}>
                {output}
              </span>
            ) : null}
          </Stack>
        ) : null}

        {logs.length > 0 ? (
          <Stack gap={4}>
            <Text fw={600} size="sm">{labels.logs}</Text>
            <MonacoCodeBlock
              value={logs.join('\n')}
              language="text"
              readOnly
              minHeight={100}
              maxHeight={260}
              ariaLabel={`${labels.title} console logs`}
              testId={`${testId}-logs`}
            />
          </Stack>
        ) : null}
      </Stack>
    </Paper>
  );
}
