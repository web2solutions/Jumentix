/* eslint-disable no-param-reassign */
import {
  arc as d3Arc,
  max as d3Max,
  min as d3Min,
  pie as d3Pie,
  scaleLinear,
  scaleOrdinal,
  sum as d3Sum
} from 'd3';

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function colorForStatus(status) {
  const key = String(status || 'unknown').toLowerCase();
  if (key === 'online') return '#1f9d55';
  if (key === 'stopping' || key === 'launching') return '#c9a227';
  if (key === 'stopped') return '#6b7280';
  if (key === 'errored') return '#dc2626';
  return '#9ca3af';
}

function clearCanvas(canvas) {
  if (!canvas) return null;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const ratio = window.devicePixelRatio || 1;
  const width = canvas.clientWidth || canvas.width || 1;
  const height = canvas.clientHeight || canvas.height || 1;
  if (canvas.width !== Math.floor(width * ratio) || canvas.height !== Math.floor(height * ratio)) {
    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);
  }
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);
  return { ctx, width, height, ratio };
}

export function drawSparkline(canvas, series, options = {}) {
  const frame = clearCanvas(canvas);
  if (!frame) return;
  const { ctx, width, height } = frame;
  const values = Array.isArray(series) ? series.map(Number).filter(Number.isFinite) : [];
  if (values.length < 2) {
    ctx.strokeStyle = options.stroke || '#94a3b8';
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();
    return;
  }
  const x = scaleLinear().domain([0, values.length - 1]).range([0, width]);
  const y = scaleLinear()
    .domain([d3Min(values) ?? 0, d3Max(values) ?? 1])
    .range([height - 2, 2]);
  ctx.beginPath();
  values.forEach((value, index) => {
    const px = x(index);
    const py = y(value);
    if (index === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.strokeStyle = options.stroke || '#2563eb';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.lineTo(width, height);
  ctx.lineTo(0, height);
  ctx.closePath();
  ctx.fillStyle = options.fill || 'rgba(37, 99, 235, 0.12)';
  ctx.fill();
}

export function drawRingGauge(canvas, ratio, options = {}) {
  const frame = clearCanvas(canvas);
  if (!frame) return;
  const { ctx, width, height } = frame;
  const value = clamp(Number(ratio) || 0, 0, 1);
  const radius = Math.min(width, height) / 2 - 6;
  const cx = width / 2;
  const cy = height / 2;
  ctx.save();
  ctx.translate(cx, cy);
  const track = d3Arc()
    .innerRadius(radius - 4)
    .outerRadius(radius)
    .startAngle(0)
    .endAngle(Math.PI * 2)
    .context(ctx);
  ctx.beginPath();
  track();
  ctx.strokeStyle = options.track || 'rgba(148, 163, 184, 0.35)';
  ctx.lineWidth = 8;
  ctx.stroke();
  const valueArc = d3Arc()
    .innerRadius(radius - 4)
    .outerRadius(radius)
    .startAngle(0)
    .endAngle(value * Math.PI * 2)
    .context(ctx);
  ctx.beginPath();
  valueArc();
  ctx.strokeStyle = options.color || '#2563eb';
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = options.labelColor || '#f8fafc';
  ctx.font = '600 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(options.label || `${Math.round(value * 100)}%`, cx, cy);
}

export function drawStackedArea(canvas, seriesByName, options = {}) {
  const frame = clearCanvas(canvas);
  if (!frame) return;
  const { ctx, width, height } = frame;
  const names = Object.keys(seriesByName || {});
  if (!names.length) return;
  const length = Math.max(...names.map((name) => (seriesByName[name] || []).length), 0);
  if (length < 2) return;
  const totals = Array.from({ length }, (_, index) => names.reduce(
    (sum, name) => sum + (Number(seriesByName[name][index]) || 0),
    0
  ));
  const max = d3Max(totals) || 1;
  const x = scaleLinear().domain([0, length - 1]).range([0, width]);
  const y = scaleLinear().domain([0, max]).range([height, 0]);
  const palette = options.colors || ['#2563eb', '#7c3aed', '#059669', '#d97706', '#dc2626', '#0891b2'];
  const color = scaleOrdinal().domain(names).range(palette);
  const stack = Array(length).fill(0);
  names.forEach((name) => {
    const series = seriesByName[name] || [];
    ctx.beginPath();
    for (let index = 0; index < length; index += 1) {
      const top = stack[index] + (Number(series[index]) || 0);
      if (index === 0) ctx.moveTo(x(index), y(top));
      else ctx.lineTo(x(index), y(top));
    }
    for (let index = length - 1; index >= 0; index -= 1) {
      ctx.lineTo(x(index), y(stack[index]));
    }
    ctx.closePath();
    ctx.fillStyle = color(name);
    ctx.globalAlpha = 0.55;
    ctx.fill();
    ctx.globalAlpha = 1;
    for (let index = 0; index < length; index += 1) {
      stack[index] += Number(series[index]) || 0;
    }
  });
}

export function drawStatusBars(canvas, statusCounts) {
  const frame = clearCanvas(canvas);
  if (!frame) return;
  const { ctx, width, height } = frame;
  const entries = Object.entries(statusCounts || {}).filter(([, value]) => Number(value) > 0);
  if (!entries.length) return;
  const pieGen = d3Pie().value((entry) => Number(entry[1])).sort(null);
  const arcs = pieGen(entries);
  const radius = Math.min(width, height) / 2 - 4;
  const generator = d3Arc().innerRadius(radius * 0.45).outerRadius(radius).context(ctx);
  ctx.save();
  ctx.translate(width / 2, height / 2);
  arcs.forEach((slice) => {
    ctx.beginPath();
    generator(slice);
    ctx.fillStyle = colorForStatus(slice.data[0]);
    ctx.fill();
  });
  ctx.restore();
  void d3Sum;
}

export function drawCoreBars(canvas, perCore) {
  const frame = clearCanvas(canvas);
  if (!frame) return;
  const { ctx, width, height } = frame;
  const values = Array.isArray(perCore) ? perCore.map(Number) : [];
  if (!values.length) return;
  const barWidth = width / values.length;
  const y = scaleLinear().domain([0, 100]).range([height - 2, 2]);
  values.forEach((value, index) => {
    const barHeight = height - y(clamp(value, 0, 100));
    ctx.fillStyle = value > 85 ? '#dc2626' : '#2563eb';
    ctx.fillRect(index * barWidth + 1, height - barHeight, Math.max(1, barWidth - 2), barHeight);
  });
}

export function drawMemoryBreakdown(canvas, parts) {
  const frame = clearCanvas(canvas);
  if (!frame) return;
  const { ctx, width, height } = frame;
  const rss = Number(parts?.rss) || 0;
  const other = Number(parts?.other) || 0;
  const free = Number(parts?.free) || 0;
  const total = rss + other + free || 1;
  const x = scaleLinear().domain([0, total]).range([0, width]);
  const segments = [
    { value: rss, color: '#7c3aed' },
    { value: other, color: '#2563eb' },
    { value: free, color: '#334155' }
  ];
  let cursor = 0;
  segments.forEach((segment) => {
    const segmentWidth = x(segment.value);
    ctx.fillStyle = segment.color;
    ctx.fillRect(cursor, 8, segmentWidth, height - 16);
    cursor += segmentWidth;
  });
}

export function drawDiskBars(canvas, volumes) {
  const frame = clearCanvas(canvas);
  if (!frame) return;
  const { ctx, width, height } = frame;
  const list = Array.isArray(volumes) ? volumes.filter((volume) => !volume.error) : [];
  if (!list.length) return;
  const rowHeight = height / list.length;
  list.forEach((volume, index) => {
    const used = clamp(Number(volume.usedPercent) || 0, 0, 100) / 100;
    const y = index * rowHeight + 4;
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, y, width, rowHeight - 8);
    ctx.fillStyle = used > 0.9 ? '#dc2626' : '#059669';
    ctx.fillRect(0, y, width * used, rowHeight - 8);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '10px sans-serif';
    ctx.fillText(`${volume.path} ${(used * 100).toFixed(0)}%`.slice(0, 42), 4, y + rowHeight - 12);
  });
}
