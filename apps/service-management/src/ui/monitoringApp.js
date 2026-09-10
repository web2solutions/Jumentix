import {
  drawCoreBars,
  drawDiskBars,
  drawMemoryBreakdown,
  drawRingGauge,
  drawSparkline,
  drawStackedArea,
  drawStatusBars
} from './monitoringCharts.js';

const HISTORY_CAP = 60;
const PROCESS_HISTORY_LIMIT = 40;
const PERSIST_DEBOUNCE_MS = 2000;

function pushSample(series, value) {
  series.push(Number.isFinite(Number(value)) ? Number(value) : 0);
  if (series.length > HISTORY_CAP) series.shift();
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
    const value = Number(bytes || 0);
    if (value >= 1024 ** 3) return `${(value / 1024 ** 3).toFixed(1)} GB`;
    if (value >= 1024 ** 2) return `${(value / 1024 ** 2).toFixed(1)} MB`;
    if (value >= 1024) return `${(value / 1024).toFixed(1)} KB`;
    return `${value} B`;
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

  function paintCharts() {
    const host = state.snapshot?.host || {};
    drawRingGauge(dom.hostCpuGauge, (Number(host.cpu?.usagePercent) || 0) / 100, {
      label: host.cpu?.usagePercent == null ? '—' : `${Number(host.cpu.usagePercent).toFixed(0)}%`,
      labelColor: '#f8fafc'
    });
    drawSparkline(dom.hostCpuSpark, state.history.aggregate.hostCpu);
    drawCoreBars(dom.hostCpuCores, (host.cpu?.perCore || []).slice(0, 16));
    drawRingGauge(dom.hostMemGauge, (Number(host.memory?.usedPercent) || 0) / 100, {
      label: `${Number(host.memory?.usedPercent || 0).toFixed(0)}%`,
      color: '#7c3aed',
      labelColor: '#f8fafc'
    });
    drawSparkline(dom.hostMemSpark, state.history.aggregate.hostMemUsedPercent, {
      stroke: '#7c3aed',
      fill: 'rgba(124, 58, 237, 0.12)'
    });
    drawMemoryBreakdown(dom.hostMemBreakdown, {
      rss: host.memory?.processRssSumBytes,
      other: host.memory?.otherBytes,
      free: host.memory?.freeBytes
    });
    drawDiskBars(dom.hostDiskBars, host.disk || []);
    drawRingGauge(
      dom.pm2HealthGauge,
      state.snapshot ? (Number(state.snapshot.summary?.onlineCount || 0)
        / Math.max(1, Number(state.snapshot.summary?.processCount || 1))) : 0,
      { label: 'PM2', labelColor: '#f8fafc' }
    );
    drawSparkline(dom.procCpuSpark, state.history.aggregate.cpuTotal);
    drawSparkline(dom.procMemSpark, state.history.aggregate.memTotal, {
      stroke: '#7c3aed',
      fill: 'rgba(124, 58, 237, 0.12)'
    });
    drawSparkline(dom.asyncActiveSpark, state.history.aggregate.asyncActiveSum, {
      stroke: '#0d9488',
      fill: 'rgba(13, 148, 136, 0.12)'
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
      if (dom.pm2MetricsStatus) dom.pm2MetricsStatus.textContent = 'WebSocket offline.';
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
        <td><strong></strong><div class="table-subtle"></div></td>
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
      tr.querySelector('strong').textContent = processEntry.name || `pm_id ${processEntry.pmId}`;
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
        cell.querySelector('pre.async').textContent = JSON.stringify(asyncContext, null, 2);
        cell.querySelector('pre.disk').textContent = JSON.stringify(processEntry.diskIo || {}, null, 2);
        detail.appendChild(cell);
        dom.pm2MetricsProcessList.appendChild(detail);
      }
    });
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
        if (dom.pm2MetricsStatus) {
          dom.pm2MetricsStatus.textContent = message.ok
            ? `${message.action} ok`
            : `${message.action} failed: ${message.error || 'unknown'}`;
          dom.pm2MetricsStatus.className = `hint status-line status-${message.ok ? 'info' : 'error'}`;
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
