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
  databaseAdapter?: string;
  databaseBackend?: string;
  attemptedBulkCount?: number;
  submittedToController?: number;
  interruptedBeforeController?: number;
  createdDuringBulk?: number;
  rejectedToDeadLetterQueue?: number;
  finalTaskCount?: number;
  shutdownReport?: {
    pendingDeadLettersAfterReplay?: number;
    deadLetterQueueFullyProcessed?: boolean;
    noLostJobs?: boolean;
  };
  replayReport?: { replayed?: string[] };
  requestTimeline?: BulkDlqTimelineEntry[];
  timeline?: BulkDlqTimelineEntry[];
  canaEvents?: CanaCanvasEvent[];
  databaseSnapshot?: CanaDatabaseSnapshot;
};
type BulkDlqTimelineEntry = {
  step?: string;
  taskId?: string;
  recordId?: string;
  source?: string;
  categoryId?: string;
};
type BulkDlqFlowKind = 'client' | 'context' | 'submitted' | 'accepted' | 'rejected' | 'interrupted' | 'replay' | 'retry' | 'contextReturn' | 'clientReturn';
type BulkDlqFlowEvent = {
  key: string;
  kind: BulkDlqFlowKind;
  taskId: string;
  label: string;
};
type BulkDlqFlowState = {
  attempted: number;
  submitted: number;
  accepted: number;
  rejected: number;
  interrupted: number;
  replayed: number;
  finalTaskCount: number;
  dlqProcessed: boolean;
  noLostJobs: boolean;
  events: BulkDlqFlowEvent[];
  hasRun: boolean;
};
type CanaCanvasEvent = {
  cursor?: number;
  type?: string;
  store?: string;
  key?: string | number;
  taskId?: string;
  categoryId?: string;
  source?: string;
};
type CanaDatabaseSnapshot = {
  adapter?: string;
  backend?: string;
  indexedDbDatabase?: string;
  stores?: {
    categories?: number;
    tasks?: number;
  };
  categoryIds?: string[];
  taskIds?: string[];
};
type CanaCanvasState = {
  events: CanaCanvasEvent[];
  backend: string;
  databaseName: string;
  categories: number;
  tasks: number;
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
    if (entry.step === 'react-component-click') {
      events.push({
        key: `${index}-client-batch`,
        kind: 'client',
        taskId: 'batch',
        label: 'component click',
      });
    }
    if (entry.step === 'react-context-submit') {
      events.push({
        key: `${index}-context-batch`,
        kind: 'context',
        taskId: 'batch',
        label: 'context submit',
      });
    }
    if (entry.step === 'bulk-import-controller') {
      events.push({
        key: `${index}-bulk-controller`,
        kind: 'submitted',
        taskId: 'batch',
        label: 'bulk controller',
      });
    }
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
    if (entry.step === 'client-request-interrupted') {
      events.push({
        key: `${index}-interrupted-${taskId}`,
        kind: 'interrupted',
        taskId,
        label: `interrupt ${taskId}`,
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
    if (entry.step === 'react-context-complete') {
      events.push({
        key: `${index}-context-return-batch`,
        kind: 'contextReturn',
        taskId: 'state',
        label: 'context state',
      });
    }
    if (entry.step === 'react-component-render') {
      events.push({
        key: `${index}-client-return-batch`,
        kind: 'clientReturn',
        taskId: 'render',
        label: 'component render',
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
  const interruptedFromTimeline = uniqueCount(
    timeline
      .filter((entry) => entry.step === 'client-request-interrupted')
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
    submitted: metrics?.submittedToController ?? attemptedFromTimeline,
    accepted: metrics?.createdDuringBulk ?? acceptedFromTimeline,
    rejected: metrics?.rejectedToDeadLetterQueue ?? rejectedFromTimeline,
    interrupted: metrics?.interruptedBeforeController ?? interruptedFromTimeline,
    replayed: metrics?.replayReport?.replayed?.length ?? replayedFromTimeline,
    finalTaskCount: metrics?.finalTaskCount ?? acceptedFromTimeline,
    dlqProcessed: metrics?.shutdownReport?.deadLetterQueueFullyProcessed ?? false,
    noLostJobs: metrics?.shutdownReport?.noLostJobs ?? false,
    events,
    hasRun: Boolean(metrics),
  };
}

function buildCanaCanvasState(metrics: BulkDlqOutput | null): CanaCanvasState {
  const events = Array.isArray(metrics?.canaEvents) ? metrics.canaEvents : [];
  const snapshot = metrics?.databaseSnapshot;
  const categoriesFromEvents = uniqueCount(events
    .filter((event) => event.store === 'categories')
    .map((event) => String(event.key ?? event.categoryId ?? '')));
  const tasksFromEvents = uniqueCount(events
    .filter((event) => event.store === 'tasks')
    .map((event) => String(event.key ?? event.taskId ?? '')));

  return {
    events,
    backend: String(snapshot?.backend ?? metrics?.databaseBackend ?? 'pending'),
    databaseName: String(snapshot?.indexedDbDatabase ?? 'not opened yet'),
    categories: snapshot?.stores?.categories ?? categoriesFromEvents,
    tasks: snapshot?.stores?.tasks ?? tasksFromEvents,
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
      { id: 'react', label: 'React Component', x: 70, y: 78 },
      { id: 'context', label: 'Context Provider', x: 200, y: 78 },
      { id: 'controller', label: 'Controller', x: 330, y: 78 },
      { id: 'mutex', label: 'Mutex', x: 460, y: 78 },
      { id: 'store', label: 'Task Store', x: 590, y: 78 },
      { id: 'dlq', label: 'DLQ', x: 460, y: 205 },
      { id: 'replay', label: 'Replay Controller', x: 590, y: 205 },
    ];
    const flowRoutes: Record<BulkDlqFlowKind, {
      from: { x: number; y: number };
      to: { x: number; y: number };
      color: string;
      label: string;
    }> = {
      client: { from: nodes[0], to: nodes[1], color: '#38bdf8', label: 'component click' },
      context: { from: nodes[1], to: nodes[2], color: '#38bdf8', label: 'context action' },
      submitted: { from: nodes[2], to: nodes[3], color: '#2563eb', label: 'controller request' },
      accepted: { from: nodes[3], to: nodes[4], color: '#16a34a', label: 'lock acquired' },
      rejected: { from: nodes[3], to: nodes[5], color: '#dc2626', label: 'lock rejected' },
      interrupted: { from: nodes[2], to: nodes[1], color: '#facc15', label: 'input stopped' },
      replay: { from: nodes[5], to: nodes[6], color: '#ea580c', label: 'dlq replay' },
      retry: { from: nodes[6], to: nodes[3], color: '#ea580c', label: 'controller retry' },
      contextReturn: { from: nodes[2], to: nodes[1], color: '#a78bfa', label: 'context state' },
      clientReturn: { from: nodes[1], to: nodes[0], color: '#a78bfa', label: 'component render' },
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
        context.strokeStyle = node.id === 'dlq' ? '#dc2626' : node.id === 'react' || node.id === 'context' ? '#38bdf8' : '#334155';
        context.lineWidth = node.id === 'dlq' || node.id === 'react' || node.id === 'context' ? 2.5 : 1.5;
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
        const isInterrupted = event.kind === 'interrupted';
        context.globalAlpha = isRejected ? 0.98 : 0.86;
        context.fillStyle = route.color;
        context.beginPath();
        context.arc(pulseX, pulseY, isRejected ? 6.75 : isInterrupted ? 6 : 5.25, 0, Math.PI * 2);
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
      context.fillText(`admitted: ${flowState.submitted}`, 128, height - 46);
      context.fillStyle = '#fecaca';
      context.fillText(`lock rejected: ${flowState.rejected}`, 245, height - 46);
      context.fillStyle = '#fef08a';
      context.fillText(`input stopped: ${flowState.interrupted}`, 390, height - 46);
      context.fillStyle = '#fed7aa';
      context.fillText(`replayed: ${flowState.replayed}`, 18, height - 24);
      context.fillStyle = '#e2e8f0';
      context.fillText(`final tasks: ${flowState.finalTaskCount}`, 128, height - 24);
      context.fillStyle = flowState.dlqProcessed && flowState.noLostJobs ? '#bbf7d0' : '#cbd5e1';
      context.fillText(`dlq drained: ${flowState.dlqProcessed ? 'yes' : 'no'} | no lost jobs: ${flowState.noLostJobs ? 'yes' : 'no'}`, 265, height - 24);

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
            ? 'O fluxo começa no componente React com Context API, passa por controller, mutex, DLQ e Cana, e volta ao componente. Rejeições pelo lock aparecem em vermelho.'
            : 'The flow starts in the React Context API component, passes through controller, mutex, DLQ, and Cana, then returns to the component. Lock rejections are red.'}
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
        <span><i data-tone="interrupted" />{locale === 'pt-BR' ? 'Entrada interrompida' : 'Input stopped'}</span>
        <span><i data-tone="replay" />Replay</span>
      </div>
      <div className={classes.flowStats} data-testid={`${testId}-flow-state`}>
        <span>{locale === 'pt-BR' ? 'Tentadas' : 'Attempted'}: {flowState.attempted}</span>
        <span>{locale === 'pt-BR' ? 'Admitidas no controller' : 'Admitted to controller'}: {flowState.submitted}</span>
        <span>{locale === 'pt-BR' ? 'Aceitas no bulk' : 'Accepted in bulk'}: {flowState.accepted}</span>
        <span>{locale === 'pt-BR' ? 'Rejeitadas pelo lock' : 'Rejected by lock'}: {flowState.rejected}</span>
        <span>{locale === 'pt-BR' ? 'Interrompidas antes do controller' : 'Interrupted before controller'}: {flowState.interrupted}</span>
        <span>{locale === 'pt-BR' ? 'Reprocessadas' : 'Replayed'}: {flowState.replayed}</span>
        <span>{locale === 'pt-BR' ? 'DLQ drenada' : 'DLQ drained'}: {flowState.dlqProcessed ? 'yes' : 'no'}</span>
        <span>{locale === 'pt-BR' ? 'Sem jobs perdidos' : 'No lost jobs'}: {flowState.noLostJobs ? 'yes' : 'no'}</span>
        <span>{locale === 'pt-BR' ? 'Tasks finais' : 'Final tasks'}: {flowState.finalTaskCount}</span>
        <span>{locale === 'pt-BR' ? 'Eventos reais' : 'Real events'}: {flowState.events.length}</span>
      </div>
      <CanaIndexedDbFlowCanvas
        output={output}
        running={running}
        locale={locale}
        testId={testId}
      />
    </section>
  );
}

function CanaIndexedDbFlowCanvas({
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
  const canaState = useMemo(() => buildCanaCanvasState(metrics), [metrics]);

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
      { id: 'adapter', label: 'Cana DB Adapter', x: 86, y: 78 },
      { id: 'client', label: 'Cana Client', x: 238, y: 78 },
      { id: 'transaction', label: 'Transaction', x: 390, y: 78 },
      { id: 'table', label: 'Table API', x: 542, y: 78 },
      { id: 'indexeddb', label: 'IndexedDB', x: 390, y: 202 },
      { id: 'events', label: 'Change Events', x: 238, y: 202 },
      { id: 'subscriber', label: 'Canvas Subscriber', x: 86, y: 202 },
    ];
    const routes = [
      { from: nodes[0], to: nodes[1], color: '#38bdf8', label: 'adapter call' },
      { from: nodes[1], to: nodes[2], color: '#38bdf8', label: 'client write' },
      { from: nodes[2], to: nodes[3], color: '#a78bfa', label: 'transaction scope' },
      { from: nodes[3], to: nodes[4], color: '#22c55e', label: 'store commit' },
      { from: nodes[4], to: nodes[5], color: '#f59e0b', label: 'commit event' },
      { from: nodes[5], to: nodes[6], color: '#f59e0b', label: 'subscribe()' },
    ];

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
      context.globalAlpha = active ? 0.88 : 0.28;
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

      routes.forEach((route) => {
        drawArrow(route.from, route.to, route.color, canaState.hasRun);
        context.globalAlpha = canaState.hasRun ? 0.78 : 0.32;
        context.fillStyle = route.color;
        context.fillText(route.label, (route.from.x + route.to.x) / 2 - 36, (route.from.y + route.to.y) / 2 - 10);
        context.globalAlpha = 1;
      });

      nodes.forEach((node) => {
        const isStorage = node.id === 'indexeddb';
        const isEvents = node.id === 'events' || node.id === 'subscriber';
        context.fillStyle = isStorage ? '#102214' : isEvents ? '#221707' : '#0f1b2d';
        context.strokeStyle = isStorage ? '#22c55e' : isEvents ? '#f59e0b' : '#334155';
        context.lineWidth = canaState.hasRun ? 2.5 : 1.5;
        context.beginPath();
        context.roundRect(node.x - 60, node.y - 24, 120, 48, 9);
        context.fill();
        context.stroke();
        context.textAlign = 'center';
        context.fillStyle = '#e2e8f0';
        context.fillText(node.label, node.x, node.y + 4);
      });

      canaState.events.forEach((event, index) => {
        const routeIndex = Math.floor(((time / 1700 + index / Math.max(canaState.events.length, 1)) % 1) * routes.length);
        const route = routes[Math.min(routeIndex, routes.length - 1)];
        const localProgress = ((time / 1700 + index / Math.max(canaState.events.length, 1)) * routes.length) % 1;
        const pulseX = route.from.x + (route.to.x - route.from.x) * localProgress;
        const pulseY = route.from.y + (route.to.y - route.from.y) * localProgress;
        const isTask = event.store === 'tasks';
        context.globalAlpha = 0.94;
        context.fillStyle = isTask ? '#22c55e' : '#38bdf8';
        context.beginPath();
        context.arc(pulseX, pulseY, isTask ? 6 : 5, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = '#e2e8f0';
        context.font = '800 11px system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
        context.fillText(`${event.store ?? 'store'}:${String(event.key ?? event.cursor ?? index + 1)}`, pulseX + 24, pulseY - 8);
        context.globalAlpha = 1;
      });

      context.textAlign = 'left';
      context.font = '800 13px system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
      context.fillStyle = '#e2e8f0';
      context.fillText(`backend: ${canaState.backend}`, 18, height - 48);
      context.fillStyle = '#bbf7d0';
      context.fillText(`categories: ${canaState.categories}`, 170, height - 48);
      context.fillText(`tasks: ${canaState.tasks}`, 285, height - 48);
      context.fillStyle = '#fed7aa';
      context.fillText(`cana events: ${canaState.events.length}`, 370, height - 48);
      context.fillStyle = '#cbd5e1';
      context.fillText(`db: ${canaState.databaseName}`, 18, height - 24);

      if (!canaState.hasRun) {
        context.fillStyle = running ? '#bfdbfe' : '#94a3b8';
        context.font = '800 14px system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
        context.fillText(
          running ? 'waiting for Cana commit events...' : 'run the playground to animate Cana events',
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
  }, [canaState, running]);

  return (
    <div className={classes.canaFlowPanel} aria-label={locale === 'pt-BR' ? 'Fluxo visual do Cana e IndexedDB' : 'Cana and IndexedDB visual flow'}>
      <div>
        <Title order={5}>
          {locale === 'pt-BR' ? 'Cana + IndexedDB em tempo real' : 'Cana + IndexedDB live state'}
        </Title>
        <Text size="sm" c="dimmed">
          {locale === 'pt-BR'
            ? 'Este canvas usa os eventos reais do Cana para animar adapter, client, transaction, Table API, IndexedDB e subscribers a cada commit.'
            : 'This canvas uses real Cana events to animate adapter, client, transaction, Table API, IndexedDB, and subscribers on each commit.'}
        </Text>
      </div>
      <canvas
        ref={canvasRef}
        className={classes.flowCanvas}
        role="img"
        aria-label={locale === 'pt-BR'
          ? 'Canvas mostrando componentes do Cana funcionando sobre IndexedDB por evento'
          : 'Canvas showing Cana components working over IndexedDB for each event'}
        data-testid={`${testId}-cana-flow-canvas`}
      />
      <div className={classes.flowLegend}>
        <span><i data-tone="cana" />Cana</span>
        <span><i data-tone="accepted" />IndexedDB</span>
        <span><i data-tone="events" />{locale === 'pt-BR' ? 'Eventos do Cana' : 'Cana events'}</span>
      </div>
      <div className={classes.flowStats} data-testid={`${testId}-cana-flow-state`}>
        <span>{locale === 'pt-BR' ? 'Backend' : 'Backend'}: {canaState.backend}</span>
        <span>Categories: {canaState.categories}</span>
        <span>Tasks: {canaState.tasks}</span>
        <span>{locale === 'pt-BR' ? 'Eventos Cana' : 'Cana events'}: {canaState.events.length}</span>
        <span>{locale === 'pt-BR' ? 'Banco' : 'Database'}: {canaState.databaseName}</span>
      </div>
    </div>
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
