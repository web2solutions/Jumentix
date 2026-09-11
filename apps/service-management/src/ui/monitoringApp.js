import {
  computeWindowThroughput,
  drawCoreBars,
  drawDiskBars,
  drawMemoryBreakdown,
  drawRingGauge,
  drawSparkline,
  drawStackedArea,
  drawStatusBars,
  formatBytesValue,
  formatPercentValue,
  formatSeriesSummary,
  formatThroughputValue,
  legendEntriesForStack
} from './monitoringCharts.js';
import { describeProcessHelp } from './processHelpCatalog.js';
import { createHelpPopoverState, resolveOpenHelpKey } from './helpPopoverState.js';

const HISTORY_CAP = 60;
const PROCESS_HISTORY_LIMIT = 40;
const PERSIST_DEBOUNCE_MS = 2000;

function pushSample(series, value) {
  series.push(Number.isFinite(Number(value)) ? Number(value) : 0);
  if (series.length > HISTORY_CAP) series.shift();
}

function formatDiskIoSummary(diskIo, formatBytes) {
  if (!diskIo || typeof diskIo !== 'object') return '—';
  if (diskIo.error) {
    return `unavailable (${diskIo.code || 'error'})`;
  }
  if (diskIo.readBytes == null && diskIo.writeBytes == null) return '—';
  return `R ${formatBytes(diskIo.readBytes)} / W ${formatBytes(diskIo.writeBytes)}`;
}

function formatAsyncContextSummary(asyncContext) {
  if (asyncContext == null) return '— (no HTTP port)';
  if (asyncContext.error) {
    return `unavailable (${asyncContext.code || 'error'})`;
  }
  const active = asyncContext.active != null ? String(asyncContext.active) : '—';
  const entered = asyncContext.enteredTotal != null ? String(asyncContext.enteredTotal) : '—';
  return `active ${active} · entered ${entered}`;
}

export function createMonitoringController(dom, options = {}) {
  const getPersistedHistory = typeof options.getHistory === 'function'
    ? options.getHistory
    : () => null;
  const setPersistedHistory = typeof options.setHistory === 'function'
    ? options.setHistory
    : () => {};
  const persistHistory = typeof options.persist === 'function'
    ? options.persist
    : () => {};
  // Which process-help popover is open, tracked by process key so it survives
  // the table re-render each WebSocket push triggers (JUM-770).
  const helpPopover = createHelpPopoverState();

  // Visible, hard-to-miss action feedback (JUM-770): a status line is easy to
  // overlook; refused/unsent actions also raise a toast.
  function showToast(message, tone = 'error') {
    if (typeof document === 'undefined' || !document.body) return;
    const toast = document.createElement('div');
    toast.className = `monitoring-toast monitoring-toast-${tone}`;
    toast.setAttribute('role', 'alert');
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
      try { toast.remove(); } catch (_error) { /* ignore */ }
    }, 4500);
  }

  const state = {
    ws: null,
    snapshot: null,
    active: false,
    filters: {
      query: '',
      status: 'all',
      namespace: 'all',
      expectedOnly: false,
      missingOnly: false
    },
    intervalMs: 1000,
    environment: 'dev',
    expanded: new Set(),
    pendingAction: null,
    persistTimer: null,
    history: {
      aggregate: {
        cpuTotal: [],
        memTotal: [],
        onlineRatio: [],
        restartTotal: [],
        asyncActiveSum: [],
        hostCpu: [],
        hostLoad1: [],
        hostMemUsedPercent: [],
        sampleTimes: []
      },
      processes: new Map(),
      disks: new Map()
    }
  };

  function hydrateFromPersisted() {
    const persisted = getPersistedHistory();
    if (!persisted || typeof persisted !== 'object') return;
    const samples = Array.isArray(persisted.samples) ? persisted.samples : [];
    state.history.aggregate.cpuTotal = samples.map((sample) => Number(sample.cpuTotal) || 0);
    state.history.aggregate.memTotal = samples.map((sample) => Number(sample.memTotal) || 0);
    state.history.aggregate.onlineRatio = samples.map((sample) => Number(sample.onlineRatio) || 0);
    state.history.aggregate.asyncActiveSum = samples.map((sample) => Number(sample.asyncActiveSum) || 0);
    state.history.aggregate.hostCpu = samples.map((sample) => (
      sample.hostCpu == null ? 0 : Number(sample.hostCpu) || 0
    ));
    state.history.aggregate.hostMemUsedPercent = samples.map((sample) => (
      sample.hostMemUsedPercent == null ? 0 : Number(sample.hostMemUsedPercent) || 0
    ));
    state.history.aggregate.sampleTimes = samples.map((sample) => String(sample.t || ''));
    state.history.processes.clear();
    Object.entries(persisted.processes || {}).forEach(([key, bucket]) => {
      state.history.processes.set(key, {
        cpu: Array.isArray(bucket?.cpu) ? bucket.cpu.map(Number).filter(Number.isFinite) : [],
        mem: Array.isArray(bucket?.mem) ? bucket.mem.map(Number).filter(Number.isFinite) : [],
        restarts: Array.isArray(bucket?.restarts) ? bucket.restarts.map(Number).filter(Number.isFinite) : [],
        asyncActive: Array.isArray(bucket?.asyncActive)
          ? bucket.asyncActive.map(Number).filter(Number.isFinite)
          : [],
        diskReadBytes: Array.isArray(bucket?.diskReadBytes)
          ? bucket.diskReadBytes.map(Number).filter(Number.isFinite)
          : [],
        diskWriteBytes: Array.isArray(bucket?.diskWriteBytes)
          ? bucket.diskWriteBytes.map(Number).filter(Number.isFinite)
          : []
      });
    });
  }

  function schedulePersist() {
    if (state.persistTimer) clearTimeout(state.persistTimer);
    state.persistTimer = setTimeout(() => {
      const processes = {};
      const keys = [...state.history.processes.keys()].slice(-PROCESS_HISTORY_LIMIT);
      keys.forEach((key) => {
        const bucket = state.history.processes.get(key);
        if (!bucket) return;
        processes[key] = {
          cpu: [...bucket.cpu],
          mem: [...bucket.mem],
          restarts: [...bucket.restarts],
          asyncActive: [...bucket.asyncActive],
          diskReadBytes: [...(bucket.diskReadBytes || [])],
          diskWriteBytes: [...(bucket.diskWriteBytes || [])]
        };
      });
      const length = state.history.aggregate.sampleTimes.length;
      const samples = [];
      for (let index = 0; index < length; index += 1) {
        samples.push({
          t: state.history.aggregate.sampleTimes[index] || '',
          hostCpu: state.history.aggregate.hostCpu[index] ?? null,
          hostMemUsedPercent: state.history.aggregate.hostMemUsedPercent[index] ?? null,
          cpuTotal: state.history.aggregate.cpuTotal[index] || 0,
          memTotal: state.history.aggregate.memTotal[index] || 0,
          onlineRatio: state.history.aggregate.onlineRatio[index] || 0,
          asyncActiveSum: state.history.aggregate.asyncActiveSum[index] || 0
        });
      }
      setPersistedHistory({
        version: 1,
        updatedAt: new Date().toISOString(),
        environment: state.environment,
        samples,
        processes
      });
      persistHistory();
    }, PERSIST_DEBOUNCE_MS);
  }

  function wsUrl() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/api/runtime/pm2-ws`;
  }

  function setConn(label, tone) {
    if (dom.pm2WsStatus) {
      dom.pm2WsStatus.textContent = label;
      dom.pm2WsStatus.dataset.tone = tone;
    }
  }

  function formatBytes(bytes) {
    return formatBytesValue(bytes);
  }

  function processKey(processEntry) {
    return `${processEntry.namespace || 'default'}::${processEntry.name || processEntry.pmId}`;
  }

  function recordHistory(snapshot) {
    const summary = snapshot?.summary || {};
    const host = snapshot?.host || {};
    const processes = Array.isArray(snapshot?.processes) ? snapshot.processes : [];
    const onlineRatio = summary.processCount
      ? (Number(summary.onlineCount || 0) / Number(summary.processCount || 1))
      : 0;
    pushSample(state.history.aggregate.cpuTotal, summary.totalCpuPercent);
    pushSample(state.history.aggregate.memTotal, summary.totalMemoryBytes);
    pushSample(state.history.aggregate.onlineRatio, onlineRatio * 100);
    pushSample(
      state.history.aggregate.restartTotal,
      processes.reduce((sum, entry) => sum + Number(entry.restartCount || 0), 0)
    );
    pushSample(state.history.aggregate.asyncActiveSum, summary.asyncContextActiveSum);
    pushSample(state.history.aggregate.hostCpu, host.cpu?.usagePercent);
    pushSample(state.history.aggregate.hostLoad1, host.cpu?.loadAvg?.one);
    pushSample(state.history.aggregate.hostMemUsedPercent, host.memory?.usedPercent);
    state.history.aggregate.sampleTimes.push(String(snapshot?.collectedAt || new Date().toISOString()));
    if (state.history.aggregate.sampleTimes.length > HISTORY_CAP) {
      state.history.aggregate.sampleTimes.shift();
    }
    processes.forEach((processEntry) => {
      const key = processKey(processEntry);
      if (!state.history.processes.has(key)) {
        state.history.processes.set(key, {
          cpu: [],
          mem: [],
          restarts: [],
          asyncActive: [],
          asyncEntered: [],
          diskReadBytes: [],
          diskWriteBytes: []
        });
      }
      const bucket = state.history.processes.get(key);
      pushSample(bucket.cpu, processEntry.cpuPercent);
      pushSample(bucket.mem, processEntry.memoryBytes);
      pushSample(bucket.restarts, processEntry.restartCount);
      pushSample(bucket.asyncActive, processEntry.asyncContext?.active);
      pushSample(bucket.asyncEntered, processEntry.asyncContext?.enteredTotal);
      pushSample(bucket.diskReadBytes, processEntry.diskIo?.readBytes);
      pushSample(bucket.diskWriteBytes, processEntry.diskIo?.writeBytes);
    });
    while (state.history.processes.size > PROCESS_HISTORY_LIMIT) {
      const oldest = state.history.processes.keys().next().value;
      state.history.processes.delete(oldest);
    }
    (host.disk || []).forEach((volume) => {
      if (!volume?.path || volume.error) return;
      if (!state.history.disks.has(volume.path)) state.history.disks.set(volume.path, []);
      pushSample(state.history.disks.get(volume.path), volume.usedPercent);
    });
    schedulePersist();
  }

  function filteredProcesses() {
    const processes = Array.isArray(state.snapshot?.processes) ? state.snapshot.processes : [];
    const missing = new Set(state.snapshot?.ecosystem?.missingExpected || []);
    const expected = new Set(
      (state.snapshot?.ecosystem?.expectedProcessCount
        ? processes.map((entry) => entry.name)
        : processes.map((entry) => entry.name))
    );
    return processes.filter((processEntry) => {
      if (state.filters.namespace !== 'all' && processEntry.namespace !== state.filters.namespace) {
        return false;
      }
      if (state.filters.status !== 'all' && processEntry.status !== state.filters.status) {
        return false;
      }
      if (state.filters.expectedOnly && !expected.has(processEntry.name)) return false;
      if (state.filters.missingOnly && !missing.has(processEntry.name)) return false;
      if (!state.filters.query) return true;
      const hay = `${processEntry.name} ${processEntry.script} ${processEntry.namespace}`.toLowerCase();
      return hay.includes(state.filters.query.toLowerCase());
    });
  }

  function setStats(element, text) {
    if (element) element.textContent = text;
  }

  function renderStackLegend(listElement, seriesByName, format) {
    if (!listElement) return;
    listElement.innerHTML = '';
    legendEntriesForStack(seriesByName).forEach((entry) => {
      const item = document.createElement('li');
      const swatch = document.createElement('span');
      swatch.className = 'chart-legend-swatch';
      swatch.style.backgroundColor = entry.color;
      const label = document.createElement('span');
      label.textContent = `${entry.name} ${format(entry.current)}`;
      item.appendChild(swatch);
      item.appendChild(label);
      listElement.appendChild(item);
    });
  }

  function paintCharts() {
    const host = state.snapshot?.host || {};
    const summary = state.snapshot?.summary || {};
    const aggregate = state.history.aggregate;
    const percentTick = (value) => formatPercentValue(value);
    const intervalSeconds = Math.max(0.5, Number(state.intervalMs || 1000) / 1000);
    const coreCount = Math.max(1, Number(host.cpu?.coreCount) || 1);
    // load1 plotted next to CPU, normalized to per-core capacity percent so
    // the two series share one scale (JUM-770).
    const loadSeries = aggregate.hostLoad1.map((value) => (Number(value) / coreCount) * 100);
    drawRingGauge(dom.hostCpuGauge, (Number(host.cpu?.usagePercent) || 0) / 100, {
      label: host.cpu?.usagePercent == null ? '—' : `${Number(host.cpu.usagePercent).toFixed(0)}%`,
      labelColor: '#f8fafc'
    });
    drawSparkline(dom.hostCpuSpark, aggregate.hostCpu, {
      overlay: { series: loadSeries, stroke: '#f59e0b' },
      yAxis: { format: percentTick }
    });
    drawCoreBars(dom.hostCpuCores, (host.cpu?.perCore || []).slice(0, 16));
    drawRingGauge(dom.hostMemGauge, (Number(host.memory?.usedPercent) || 0) / 100, {
      label: `${Number(host.memory?.usedPercent || 0).toFixed(0)}%`,
      color: '#7c3aed',
      labelColor: '#f8fafc'
    });
    drawSparkline(dom.hostMemSpark, aggregate.hostMemUsedPercent, {
      stroke: '#7c3aed',
      fill: 'rgba(124, 58, 237, 0.12)',
      yAxis: { format: percentTick }
    });
    drawMemoryBreakdown(dom.hostMemBreakdown, {
      rss: host.memory?.processRssSumBytes,
      other: host.memory?.otherBytes,
      free: host.memory?.freeBytes
    });
    drawDiskBars(dom.hostDiskBars, host.disk || []);
    const online = Number(summary.onlineCount || 0);
    const total = Number(summary.processCount || 0);
    drawRingGauge(
      dom.pm2HealthGauge,
      state.snapshot ? online / Math.max(1, total) : 0,
      { label: state.snapshot ? `${online}/${total}` : '—', labelColor: '#f8fafc' }
    );
    drawSparkline(dom.procCpuSpark, aggregate.cpuTotal, { yAxis: { format: percentTick } });
    drawSparkline(dom.procMemSpark, aggregate.memTotal, {
      stroke: '#7c3aed',
      fill: 'rgba(124, 58, 237, 0.12)',
      yAxis: { format: formatBytesValue }
    });
    drawSparkline(dom.asyncActiveSpark, aggregate.asyncActiveSum, {
      stroke: '#0d9488',
      fill: 'rgba(13, 148, 136, 0.12)',
      yAxis: { format: (value) => String(Math.round(value)) }
    });
    const filtered = filteredProcesses();
    const cpuSeries = {};
    const memSeries = {};
    filtered.slice(0, 8).forEach((processEntry) => {
      const key = processKey(processEntry);
      const hist = state.history.processes.get(key);
      if (!hist) return;
      cpuSeries[processEntry.name || key] = hist.cpu;
      memSeries[processEntry.name || key] = hist.mem;
    });
    drawStackedArea(dom.stackCpuCanvas, cpuSeries);
    drawStackedArea(dom.stackMemCanvas, memSeries);
    drawStatusBars(dom.statusBarsCanvas, state.snapshot?.summary?.statusCounts || {});

    // Numbers over shapes (JUM-770): every chart gets a readable header.
    setStats(dom.hostCpuGaugeStats, formatSeriesSummary(aggregate.hostCpu, percentTick));
    setStats(
      dom.hostCpuSparkStats,
      `load1 ${Number(host.cpu?.loadAvg?.one || 0).toFixed(2)} (${formatPercentValue(loadSeries.length ? loadSeries[loadSeries.length - 1] : 0)}/core)`
    );
    const perCore = (host.cpu?.perCore || []).map(Number).filter(Number.isFinite);
    setStats(
      dom.hostCpuCoresStats,
      perCore.length
        ? `avg ${formatPercentValue(perCore.reduce((sum, value) => sum + value, 0) / perCore.length, 1)} · peak core ${formatPercentValue(Math.max(...perCore))}`
        : '—'
    );
    setStats(
      dom.hostMemGaugeStats,
      host.memory
        ? `${formatPercentValue(host.memory.usedPercent)} · ${formatBytesValue(host.memory.usedBytes)} / ${formatBytesValue(host.memory.totalBytes)}`
        : '—'
    );
    setStats(dom.hostMemSparkStats, formatSeriesSummary(aggregate.hostMemUsedPercent, percentTick));
    setStats(
      dom.hostMemBreakdownStats,
      host.memory
        ? `RSS ${formatBytesValue(host.memory.processRssSumBytes)} · other ${formatBytesValue(host.memory.otherBytes)} · free ${formatBytesValue(host.memory.freeBytes)}`
        : '—'
    );
    let readRate = 0;
    let writeRate = 0;
    let hasIo = false;
    state.history.processes.forEach((bucket) => {
      const read = computeWindowThroughput(bucket.diskReadBytes, intervalSeconds);
      const write = computeWindowThroughput(bucket.diskWriteBytes, intervalSeconds);
      if (read != null) { readRate += read; hasIo = true; }
      if (write != null) { writeRate += write; hasIo = true; }
    });
    const volumeText = (host.disk || [])
      .filter((volume) => !volume.error)
      .map((volume) => `${volume.path} ${formatPercentValue(volume.usedPercent)}`)
      .join(' · ');
    setStats(
      dom.hostDiskBarsStats,
      `${volumeText || '—'}${hasIo ? ` · IO R ${formatThroughputValue(readRate)} · W ${formatThroughputValue(writeRate)}` : ''}`
    );
    const restartSummary = aggregate.restartTotal.length
      ? aggregate.restartTotal[aggregate.restartTotal.length - 1]
      : 0;
    setStats(dom.pm2HealthGaugeStats, `Σ restarts ${Math.round(restartSummary)}`);
    setStats(dom.procCpuSparkStats, formatSeriesSummary(aggregate.cpuTotal, (value) => formatPercentValue(value, 1)));
    setStats(dom.procMemSparkStats, formatSeriesSummary(aggregate.memTotal, formatBytesValue));
    setStats(dom.asyncActiveSparkStats, formatSeriesSummary(aggregate.asyncActiveSum, (value) => String(Math.round(value))));
    renderStackLegend(dom.stackCpuLegend, cpuSeries, (value) => formatPercentValue(value, 1));
    renderStackLegend(dom.stackMemLegend, memSeries, formatBytesValue);
    const statusCounts = state.snapshot?.summary?.statusCounts || {};
    const statusText = Object.entries(statusCounts)
      .filter(([, count]) => Number(count) > 0)
      .map(([status, count]) => `${status} ${count}`)
      .join(' · ');
    setStats(dom.statusBarsStats, statusText || '—');
  }

  function renderHostText() {
    const host = state.snapshot?.host || {};
    if (dom.hostCpuMeta) {
      dom.hostCpuMeta.textContent = host.cpu
        ? `${host.cpu.coreCount} cores · load ${Number(host.cpu.loadAvg?.one || 0).toFixed(2)}`
          + ` / ${Number(host.cpu.loadAvg?.five || 0).toFixed(2)}`
          + ` / ${Number(host.cpu.loadAvg?.fifteen || 0).toFixed(2)}`
          + ` · Σ proc ${Number(host.cpu.processCpuPercentSum || 0).toFixed(1)}%`
        : '—';
    }
    if (dom.hostMemMeta) {
      dom.hostMemMeta.textContent = host.memory
        ? `${formatBytes(host.memory.usedBytes)} / ${formatBytes(host.memory.totalBytes)}`
          + ` · RSS ${formatBytes(host.memory.processRssSumBytes)}`
        : '—';
    }
    if (dom.hostDiskMeta) {
      const ok = (host.disk || []).filter((volume) => !volume.error);
      dom.hostDiskMeta.textContent = ok.length
        ? `${ok.length} volume(s)`
        : 'no volumes';
    }
    if (dom.asyncActiveSum) {
      dom.asyncActiveSum.textContent = String(state.snapshot?.summary?.asyncContextActiveSum || 0);
    }
  }

  function sendAction(payload) {
    if (!state.ws || state.ws.readyState !== WebSocket.OPEN) {
      if (dom.pm2MetricsStatus) {
        dom.pm2MetricsStatus.textContent = `WebSocket offline — "${payload.action}" was NOT sent. Wait for reconnect and try again.`;
        dom.pm2MetricsStatus.className = 'hint status-line status-error';
      }
      showToast(`WebSocket offline: "${payload.action}" was not sent.`, 'error');
      return;
    }
    state.pendingAction = `${payload.action}:${payload.name || payload.namespace || ''}`;
    state.ws.send(JSON.stringify({ type: 'action', ...payload }));
    render();
  }

  function renderTable() {
    if (!dom.pm2MetricsProcessList) return;
    dom.pm2MetricsProcessList.innerHTML = '';
    const rows = filteredProcesses();
    if (!rows.length) {
      const empty = document.createElement('tr');
      empty.innerHTML = '<td colspan="9">No processes match filters.</td>';
      dom.pm2MetricsProcessList.appendChild(empty);
      return;
    }
    rows.forEach((processEntry) => {
      const key = processKey(processEntry);
      const tr = document.createElement('tr');
      tr.dataset.key = key;
      const hist = state.history.processes.get(key) || { cpu: [], mem: [] };
      tr.innerHTML = `
        <td><button type="button" class="linkish expand-btn">${state.expanded.has(key) ? '−' : '+'}</button></td>
        <td class="process-name-cell">
          <div class="process-name-row">
            <strong></strong>
            <button type="button" class="process-help-btn" aria-expanded="false">?</button>
          </div>
          <div class="table-subtle"></div>
          <div class="process-help-popover" hidden role="dialog"></div>
        </td>
        <td><span class="process-status"></span></td>
        <td><span class="metric-cell-value"></span><canvas class="mini-spark cpu" width="72" height="24"></canvas></td>
        <td><span class="metric-cell-value"></span><canvas class="mini-spark mem" width="72" height="24"></canvas></td>
        <td><span class="restart-pill"></span></td>
        <td class="async-cell"></td>
        <td class="uptime-cell"></td>
        <td class="actions-cell">
          <button type="button" data-action="start">Start</button>
          <button type="button" data-action="stop">Stop</button>
          <button type="button" data-action="restart">Restart</button>
        </td>`;
      const processLabel = processEntry.name || `pm_id ${processEntry.pmId}`;
      tr.querySelector('strong').textContent = processLabel;
      const help = describeProcessHelp(processEntry);
      const helpBtn = tr.querySelector('.process-help-btn');
      const helpPop = tr.querySelector('.process-help-popover');
      helpBtn.setAttribute('aria-label', `What is ${processLabel}?`);
      helpPop.textContent = help.summary;
      helpBtn.onclick = (event) => {
        event.stopPropagation();
        const openedKey = helpPopover.toggle(key);
        document.querySelectorAll('.process-help-popover').forEach((node) => {
          node.setAttribute('hidden', '');
        });
        document.querySelectorAll('.process-help-btn').forEach((node) => {
          node.setAttribute('aria-expanded', 'false');
        });
        if (openedKey) {
          helpPop.removeAttribute('hidden');
          helpBtn.setAttribute('aria-expanded', 'true');
        }
      };
      tr.querySelector('.table-subtle').textContent = [
        processEntry.namespace,
        processEntry.interpreter,
        processEntry.pmId != null ? `pm_id ${processEntry.pmId}` : ''
      ].filter(Boolean).join(' / ');
      const status = tr.querySelector('.process-status');
      status.textContent = processEntry.status || 'unknown';
      status.dataset.status = processEntry.status || 'unknown';
      tr.children[3].querySelector('.metric-cell-value').textContent = `${Number(processEntry.cpuPercent || 0).toFixed(1)}%`;
      tr.children[4].querySelector('.metric-cell-value').textContent = formatBytes(processEntry.memoryBytes);
      const restart = tr.querySelector('.restart-pill');
      restart.textContent = String(processEntry.restartCount || 0);
      tr.querySelector('.async-cell').textContent = processEntry.asyncContext?.active != null
        ? String(processEntry.asyncContext.active)
        : (processEntry.asyncContext?.error ? 'err' : '—');
      tr.querySelector('.uptime-cell').textContent = `${Math.max(0, Math.floor(Number(processEntry.uptimeMs || 0) / 60000))}m`;
      drawSparkline(tr.querySelector('canvas.cpu'), hist.cpu);
      drawSparkline(tr.querySelector('canvas.mem'), hist.mem, { stroke: '#7c3aed', fill: 'rgba(124,58,237,0.12)' });
      tr.querySelector('.expand-btn').onclick = () => {
        if (state.expanded.has(key)) state.expanded.delete(key);
        else state.expanded.add(key);
        render();
      };
      tr.querySelectorAll('[data-action]').forEach((button) => {
        const action = button.getAttribute('data-action');
        button.disabled = Boolean(state.pendingAction)
          || (action === 'start' && processEntry.status === 'online')
          || (action === 'stop' && processEntry.status === 'stopped');
        button.onclick = () => sendAction({
          action,
          scope: 'process',
          name: processEntry.name,
          pmId: processEntry.pmId
        });
      });
      dom.pm2MetricsProcessList.appendChild(tr);
      if (state.expanded.has(key)) {
        const detail = document.createElement('tr');
        detail.className = 'monitoring-detail-row';
        const cell = document.createElement('td');
        cell.colSpan = 9;
        const metrics = { ...processEntry };
        delete metrics.pm2_env;
        delete metrics.env;
        const custom = processEntry.customMetrics || {};
        const asyncContext = processEntry.asyncContext || {};
        cell.innerHTML = `
          <div class="monitoring-detail-grid">
            <section><h4>Process</h4><pre class="monitoring-pre"></pre></section>
            <section><h4>customMetrics</h4><pre class="monitoring-pre custom"></pre></section>
            <section><h4>Async context</h4><pre class="monitoring-pre async"></pre></section>
            <section><h4>diskIo</h4><pre class="monitoring-pre disk"></pre></section>
          </div>`;
        cell.querySelector('pre').textContent = JSON.stringify(metrics, null, 2);
        cell.querySelector('pre.custom').textContent = JSON.stringify(custom, null, 2);
        cell.querySelector('pre.async').textContent = formatAsyncContextSummary(asyncContext);
        cell.querySelector('pre.disk').textContent = formatDiskIoSummary(processEntry.diskIo, formatBytes);
        detail.appendChild(cell);
        dom.pm2MetricsProcessList.appendChild(detail);
      }
    });
    // Re-open the tracked help popover after this rebuild, so it survives the
    // render each WebSocket push triggers (JUM-770).
    const openKey = resolveOpenHelpKey(helpPopover.current(), rows.map((entry) => processKey(entry)));
    if (openKey) {
      const row = [...dom.pm2MetricsProcessList.querySelectorAll('tr[data-key]')]
        .find((node) => node.dataset.key === openKey);
      if (row) {
        row.querySelector('.process-help-popover')?.removeAttribute('hidden');
        row.querySelector('.process-help-btn')?.setAttribute('aria-expanded', 'true');
      }
    }
  }

  function renderEcosystem() {
    const ecosystem = state.snapshot?.ecosystem;
    if (!dom.pm2MetricsEcosystemSummary) return;
    if (dom.pm2MetricsMissingList) dom.pm2MetricsMissingList.innerHTML = '';
    if (!ecosystem) {
      dom.pm2MetricsEcosystemSummary.textContent = 'No ecosystem comparison loaded.';
      return;
    }
    if (!ecosystem.exists) {
      dom.pm2MetricsEcosystemSummary.textContent = `${ecosystem.fileName} missing.`;
      return;
    }
    if (ecosystem.missingExpected?.length) {
      dom.pm2MetricsEcosystemSummary.textContent = `${ecosystem.missingExpected.length} expected app(s) missing.`;
      ecosystem.missingExpected.forEach((name) => {
        const li = document.createElement('li');
        li.innerHTML = `<span></span> <button type="button">Start</button>`;
        li.querySelector('span').textContent = name;
        li.querySelector('button').onclick = () => sendAction({
          action: 'start',
          scope: 'ecosystem-missing',
          name
        });
        dom.pm2MetricsMissingList.appendChild(li);
      });
      return;
    }
    dom.pm2MetricsEcosystemSummary.textContent = `All ${ecosystem.expectedProcessCount} expected apps present.`;
  }

  function fillNamespaceOptions() {
    if (!dom.pm2FilterNamespace) return;
    const current = dom.pm2FilterNamespace.value || 'all';
    const namespaces = new Set(
      (state.snapshot?.processes || []).map((entry) => entry.namespace || 'default')
    );
    dom.pm2FilterNamespace.innerHTML = '<option value="all">all namespaces</option>';
    [...namespaces].sort().forEach((namespace) => {
      const option = document.createElement('option');
      option.value = namespace;
      option.textContent = namespace;
      dom.pm2FilterNamespace.appendChild(option);
    });
    dom.pm2FilterNamespace.value = [...namespaces].includes(current) || current === 'all' ? current : 'all';
    state.filters.namespace = dom.pm2FilterNamespace.value;
  }

  function render() {
    renderHostText();
    fillNamespaceOptions();
    renderTable();
    renderEcosystem();
    paintCharts();
    if (dom.pm2MetricsUpdatedAt && state.snapshot?.collectedAt) {
      dom.pm2MetricsUpdatedAt.textContent = `updated ${new Date(state.snapshot.collectedAt).toLocaleTimeString()}`;
    }
    if (dom.pm2HealthLabel && state.snapshot) {
      const summary = state.snapshot.summary || {};
      const online = Number(summary.onlineCount || 0);
      const total = Number(summary.processCount || 0);
      dom.pm2HealthLabel.textContent = total
        ? `${online}/${total} online`
        : 'No PM2 processes';
    }
    if (dom.pm2ProcessDensityLabel && state.snapshot) {
      const count = (state.snapshot.processes || []).length;
      dom.pm2ProcessDensityLabel.textContent = `${count} process${count === 1 ? '' : 'es'}`;
    }
    if (dom.pm2EcosystemState) {
      const ecosystem = state.snapshot?.ecosystem;
      if (!ecosystem) dom.pm2EcosystemState.textContent = 'unknown';
      else if (!ecosystem.exists) dom.pm2EcosystemState.textContent = 'missing file';
      else if (ecosystem.missingExpected?.length) dom.pm2EcosystemState.textContent = 'drift';
      else dom.pm2EcosystemState.textContent = 'covered';
    }
  }

  function subscribe() {
    if (!state.ws || state.ws.readyState !== WebSocket.OPEN) return;
    state.ws.send(JSON.stringify({
      type: 'subscribe',
      environment: state.environment,
      intervalMs: state.intervalMs,
      filters: state.filters
    }));
  }

  function connect() {
    if (state.ws) {
      try { state.ws.close(); } catch (_error) { /* ignore */ }
    }
    setConn('connecting', 'warn');
    const socket = new WebSocket(wsUrl());
    state.ws = socket;
    socket.addEventListener('open', () => {
      setConn('connected', 'ok');
      subscribe();
    });
    socket.addEventListener('close', () => {
      setConn('disconnected', 'error');
      if (state.active) {
        setTimeout(connect, 1500);
      }
    });
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.type === 'metrics') {
        state.snapshot = message.payload;
        recordHistory(message.payload);
        render();
      }
      if (message.type === 'action-result') {
        state.pendingAction = null;
        // Bulk (namespace) results report how many processes were affected and
        // which were skipped — the service manager is never in the batch.
        let bulkSuffix = '';
        if (message.ok && message.result && typeof message.result === 'object') {
          const affected = Number(message.result.affected);
          const skipped = Array.isArray(message.result.skipped) ? message.result.skipped : [];
          bulkSuffix = ` · affected ${Number.isFinite(affected) ? affected : 0}`;
          if (skipped.length) {
            bulkSuffix += ` · skipped (self-guard): ${skipped.join(', ')}`;
          }
        }
        if (dom.pm2MetricsStatus) {
          dom.pm2MetricsStatus.textContent = message.ok
            ? `${message.action} ok${bulkSuffix}`
            : `${message.action} failed: ${message.error || 'unknown'}`;
          dom.pm2MetricsStatus.className = `hint status-line status-${message.ok ? 'info' : 'error'}`;
        }
        if (!message.ok) {
          showToast(`${message.action} failed: ${message.error || 'unknown'}`, 'error');
        }
        render();
      }
      if (message.type === 'error' && dom.pm2MetricsStatus) {
        dom.pm2MetricsStatus.textContent = message.details || message.code || 'WS error';
        dom.pm2MetricsStatus.className = 'hint status-line status-error';
      }
    });
  }

  function start() {
    state.active = true;
    state.environment = dom.pm2MetricsEnvironmentSelect?.value || 'dev';
    state.intervalMs = Number(dom.pm2IntervalSelect?.value || 1000);
    hydrateFromPersisted();
    connect();
  }

  function stop() {
    state.active = false;
    if (state.persistTimer) {
      clearTimeout(state.persistTimer);
      state.persistTimer = null;
    }
    if (state.ws) {
      try { state.ws.close(); } catch (_error) { /* ignore */ }
      state.ws = null;
    }
  }

  function wire() {
    if (typeof document !== 'undefined') {
      document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        helpPopover.close();
        document.querySelectorAll('.process-help-popover').forEach((node) => {
          node.setAttribute('hidden', '');
        });
        document.querySelectorAll('.process-help-btn').forEach((node) => {
          node.setAttribute('aria-expanded', 'false');
        });
      });
    }
    if (dom.pm2MetricsEnvironmentSelect) {
      dom.pm2MetricsEnvironmentSelect.onchange = () => {
        state.environment = dom.pm2MetricsEnvironmentSelect.value;
        subscribe();
      };
    }
    if (dom.pm2IntervalSelect) {
      dom.pm2IntervalSelect.onchange = () => {
        state.intervalMs = Number(dom.pm2IntervalSelect.value || 1000);
        subscribe();
      };
    }
    if (dom.pm2FilterQuery) {
      dom.pm2FilterQuery.oninput = () => {
        state.filters.query = dom.pm2FilterQuery.value || '';
        render();
      };
    }
    if (dom.pm2FilterStatus) {
      dom.pm2FilterStatus.onchange = () => {
        state.filters.status = dom.pm2FilterStatus.value || 'all';
        render();
      };
    }
    if (dom.pm2FilterNamespace) {
      dom.pm2FilterNamespace.onchange = () => {
        state.filters.namespace = dom.pm2FilterNamespace.value || 'all';
        render();
      };
    }
    if (dom.pm2FilterExpectedOnly) {
      dom.pm2FilterExpectedOnly.onchange = () => {
        state.filters.expectedOnly = Boolean(dom.pm2FilterExpectedOnly.checked);
        render();
      };
    }
    if (dom.pm2FilterMissingOnly) {
      dom.pm2FilterMissingOnly.onchange = () => {
        state.filters.missingOnly = Boolean(dom.pm2FilterMissingOnly.checked);
        render();
      };
    }
    const bulk = (action) => {
      const namespace = state.filters.namespace === 'all'
        ? (dom.pm2NamespaceOpsSelect?.value || 'default')
        : state.filters.namespace;
      if (!window.confirm(`${action} all processes in namespace "${namespace}"?`)) return;
      sendAction({ action, scope: 'namespace', namespace });
    };
    if (dom.pm2NsStartBtn) dom.pm2NsStartBtn.onclick = () => bulk('start');
    if (dom.pm2NsStopBtn) dom.pm2NsStopBtn.onclick = () => bulk('stop');
    if (dom.pm2NsRestartBtn) dom.pm2NsRestartBtn.onclick = () => bulk('restart');
  }

  return { start, stop, wire, render };
}
