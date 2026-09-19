/* eslint-disable jest/prefer-expect-assertions, jest/max-expects, import/first */
/*
 * JUM-821 — canvas drawing half of monitoringCharts.js: sparklines, ring
 * gauges, stacked areas, status donuts, core bars, memory breakdown and disk
 * bars. d3 stays mocked (the jest transform keeps node_modules CJS-only), but
 * the mock is functional — real linear scales, real arc/pie geometry — so the
 * assertions check the pixels-level commands the charts emit, not mock calls.
 */

jest.mock('d3', () => {
  const scaleLinear = () => {
    let domain = [0, 1];
    let range = [0, 1];
    const scale: any = (value: number) => {
      const span = domain[1] - domain[0] || 1;
      return range[0] + ((value - domain[0]) / span) * (range[1] - range[0]);
    };
    scale.domain = (next?: number[]) => {
      if (next) { domain = next; return scale; }
      return domain;
    };
    scale.range = (next?: number[]) => {
      if (next) { range = next; return scale; }
      return range;
    };
    return scale;
  };
  const arc = () => {
    const config = {
      innerRadius: 0, outerRadius: 0, startAngle: 0, endAngle: 0
    };
    let context: any = null;
    const generator: any = (datum?: { startAngle: number; endAngle: number }) => {
      const startAngle = datum ? datum.startAngle : config.startAngle;
      const endAngle = datum ? datum.endAngle : config.endAngle;
      if (context && typeof context.arc === 'function') {
        context.arc(0, 0, config.outerRadius, startAngle, endAngle);
      }
      return '';
    };
    generator.innerRadius = (value: number) => { config.innerRadius = value; return generator; };
    generator.outerRadius = (value: number) => { config.outerRadius = value; return generator; };
    generator.startAngle = (value: number) => { config.startAngle = value; return generator; };
    generator.endAngle = (value: number) => { config.endAngle = value; return generator; };
    generator.context = (next: any) => { context = next; return generator; };
    generator.centroid = (datum: { startAngle: number; endAngle: number }) => {
      const midAngle = (datum.startAngle + datum.endAngle) / 2 - Math.PI / 2;
      const radius = (config.innerRadius + config.outerRadius) / 2;
      return [Math.cos(midAngle) * radius, Math.sin(midAngle) * radius];
    };
    return generator;
  };
  const pie = () => {
    let valueFn: (entry: any) => number = (entry) => Number(entry);
    const generator: any = (entries: any[]) => {
      const values = entries.map((entry) => valueFn(entry));
      const total = values.reduce((sum, value) => sum + value, 0) || 1;
      let angle = 0;
      return entries.map((entry, index) => {
        const startAngle = angle;
        angle += (values[index] / total) * Math.PI * 2;
        return {
          data: entry, value: values[index], startAngle, endAngle: angle
        };
      });
    };
    generator.value = (fn: (entry: any) => number) => { valueFn = fn; return generator; };
    generator.sort = () => generator;
    return generator;
  };
  return {
    arc,
    pie,
    scaleLinear,
    max: (values: number[]) => (values.length ? Math.max(...values) : undefined),
    min: (values: number[]) => (values.length ? Math.min(...values) : undefined),
    sum: (values: unknown[], accessor?: (entry: any) => number) => values.reduce(
      (total: number, entry) => total + (accessor ? accessor(entry) : Number(entry) || 0),
      0
    )
  };
});

import {
  STACK_PALETTE,
  colorForStatus,
  computeWindowThroughput,
  drawCoreBars,
  drawDiskBars,
  drawMemoryBreakdown,
  drawRingGauge,
  drawSparkline,
  drawStackedArea,
  drawStatusBars,
  formatSeriesSummary,
  legendEntriesForStack,
  stackColorAt
} from '../../src/ui/monitoringCharts.js';

type RecordedCall = [string, ...unknown[]];

function createRecordingContext() {
  const calls: RecordedCall[] = [];
  const ctx: any = {};
  const methods = [
    'setTransform', 'clearRect', 'beginPath', 'moveTo', 'lineTo', 'stroke',
    'closePath', 'fill', 'save', 'translate', 'restore', 'fillText', 'fillRect', 'arc'
  ];
  methods.forEach((name) => {
    ctx[name] = (...args: unknown[]) => { calls.push([name, ...args]); };
  });
  ['strokeStyle', 'fillStyle', 'lineWidth', 'font', 'textAlign', 'textBaseline', 'globalAlpha']
    .forEach((prop) => {
      let value: unknown;
      Object.defineProperty(ctx, prop, {
        get: () => value,
        set: (next: unknown) => { value = next; calls.push([`set:${prop}`, next]); }
      });
    });
  return { ctx, calls };
}

function createCanvas(overrides: Record<string, unknown> = {}) {
  const { ctx, calls } = createRecordingContext();
  const canvas: any = {
    clientWidth: 100,
    clientHeight: 40,
    width: 0,
    height: 0,
    getContext: () => ctx,
    ...overrides
  };
  return { canvas, ctx, calls };
}

function callsNamed(calls: RecordedCall[], name: string) {
  return calls.filter((call) => call[0] === name);
}

function installFakeWindow() {
  (globalThis as any).window = { devicePixelRatio: 1 };
}

function removeFakeWindow() {
  delete (globalThis as any).window;
}

describe('monitoringCharts canvas frame setup', () => {
  beforeEach(installFakeWindow);
  afterAll(removeFakeWindow);

  it('does nothing when the canvas or its 2d context is missing', () => {
    expect.hasAssertions();
    expect(() => drawSparkline(null, [1, 2, 3])).not.toThrow();
    expect(() => drawRingGauge(null, 0.5)).not.toThrow();
    expect(() => drawStackedArea(null, { a: [1, 2] })).not.toThrow();
    expect(() => drawStatusBars(null, { online: 1 })).not.toThrow();
    expect(() => drawCoreBars(null, [1])).not.toThrow();
    expect(() => drawMemoryBreakdown(null, { rss: 1 })).not.toThrow();
    expect(() => drawDiskBars(null, [{ path: '/', usedPercent: 10 }])).not.toThrow();
    const { canvas, calls } = createCanvas({ getContext: () => null });
    drawCoreBars(canvas, [10, 20]);
    expect(calls).toStrictEqual([]);
  });

  it('resizes the bitmap to the device pixel ratio and clears in CSS pixels', () => {
    expect.hasAssertions();
    (globalThis as any).window = { devicePixelRatio: 2 };
    const { canvas, calls } = createCanvas({ clientWidth: 50, clientHeight: 20 });
    drawCoreBars(canvas, [50]);
    expect(canvas.width).toBe(100);
    expect(canvas.height).toBe(40);
    expect(calls[0]).toStrictEqual(['setTransform', 2, 0, 0, 2, 0, 0]);
    expect(calls[1]).toStrictEqual(['clearRect', 0, 0, 50, 20]);
  });

  it('keeps the bitmap when it already matches and falls back when dimensions are zero', () => {
    expect.hasAssertions();
    (globalThis as any).window = {};
    const settled = createCanvas({
      clientWidth: 0, clientHeight: 0, width: 30, height: 12
    });
    drawCoreBars(settled.canvas, [50]);
    expect(settled.canvas.width).toBe(30);
    expect(settled.canvas.height).toBe(12);
    expect(settled.calls[0]).toStrictEqual(['setTransform', 1, 0, 0, 1, 0, 0]);
    expect(settled.calls[1]).toStrictEqual(['clearRect', 0, 0, 30, 12]);

    const empty = createCanvas({
      clientWidth: 0, clientHeight: 0, width: 0, height: 0
    });
    drawCoreBars(empty.canvas, [50]);
    expect(empty.canvas.width).toBe(1);
    expect(empty.canvas.height).toBe(1);
    expect(empty.calls[1]).toStrictEqual(['clearRect', 0, 0, 1, 1]);
  });
});

describe('monitoringCharts drawSparkline', () => {
  beforeEach(installFakeWindow);
  afterAll(removeFakeWindow);

  it('draws a flat baseline when fewer than two finite samples exist', () => {
    expect.hasAssertions();
    const { canvas, calls } = createCanvas();
    drawSparkline(canvas, ['nope']);
    expect(callsNamed(calls, 'set:strokeStyle')).toStrictEqual([['set:strokeStyle', '#94a3b8']]);
    expect(callsNamed(calls, 'moveTo')).toStrictEqual([['moveTo', 0, 20]]);
    expect(callsNamed(calls, 'lineTo')).toStrictEqual([['lineTo', 100, 20]]);
    expect(callsNamed(calls, 'stroke')).toHaveLength(1);
    expect(callsNamed(calls, 'fill')).toHaveLength(0);

    const custom = createCanvas();
    drawSparkline(custom.canvas, [], { stroke: '#000000' });
    expect(callsNamed(custom.calls, 'set:strokeStyle')).toStrictEqual([['set:strokeStyle', '#000000']]);
  });

  it('strokes the series on a min/max scale and fills the area under it', () => {
    expect.hasAssertions();
    const { canvas, calls } = createCanvas();
    drawSparkline(canvas, [10, 20, 15]);
    expect(callsNamed(calls, 'moveTo')).toStrictEqual([['moveTo', 0, 38]]);
    expect(callsNamed(calls, 'lineTo').slice(0, 2)).toStrictEqual([
      ['lineTo', 50, 2],
      ['lineTo', 100, 20]
    ]);
    expect(callsNamed(calls, 'lineTo').slice(2)).toStrictEqual([
      ['lineTo', 100, 40],
      ['lineTo', 0, 40]
    ]);
    expect(callsNamed(calls, 'set:strokeStyle')).toStrictEqual([['set:strokeStyle', '#2563eb']]);
    expect(callsNamed(calls, 'set:fillStyle')).toStrictEqual([['set:fillStyle', 'rgba(37, 99, 235, 0.12)']]);
    expect(callsNamed(calls, 'stroke')).toHaveLength(1);
    expect(callsNamed(calls, 'fill')).toHaveLength(1);
  });

  it('draws the overlay on the shared scale with its own stroke and no fill', () => {
    expect.hasAssertions();
    const { canvas, calls } = createCanvas();
    drawSparkline(canvas, [10, 20], {
      stroke: '#111111',
      fill: '#222222',
      overlay: { series: [15, 25] }
    });
    // the overlay joins the scale: min/max over [10, 20, 15, 25] is 10..25,
    // so y maps 10 -> 38 and 15 -> 26.
    expect(callsNamed(calls, 'moveTo')).toStrictEqual([
      ['moveTo', 0, 38],
      ['moveTo', 0, 26]
    ]);
    expect(callsNamed(calls, 'set:strokeStyle')).toStrictEqual([
      ['set:strokeStyle', '#111111'],
      ['set:strokeStyle', '#f59e0b']
    ]);
    expect(callsNamed(calls, 'stroke')).toHaveLength(2);
    expect(callsNamed(calls, 'fill')).toHaveLength(1);

    const customOverlay = createCanvas();
    drawSparkline(customOverlay.canvas, [1, 2], {
      overlay: { series: [3, 4], stroke: '#abcdef' }
    });
    expect(callsNamed(customOverlay.calls, 'set:strokeStyle')).toStrictEqual([
      ['set:strokeStyle', '#2563eb'],
      ['set:strokeStyle', '#abcdef']
    ]);
  });

  it('ignores overlays that are not usable series', () => {
    expect.hasAssertions();
    const missing = createCanvas();
    drawSparkline(missing.canvas, [1, 2], { overlay: { series: 'nope' } });
    expect(callsNamed(missing.calls, 'stroke')).toHaveLength(1);

    const single = createCanvas();
    drawSparkline(single.canvas, [1, 2], { overlay: { series: [9] } });
    expect(callsNamed(single.calls, 'stroke')).toHaveLength(1);
  });

  it('prints min/max Y-axis ticks with the given formatter', () => {
    expect.hasAssertions();
    const { canvas, calls } = createCanvas();
    drawSparkline(canvas, [10, 20], {
      yAxis: { format: (value: number) => `${value}ms` }
    });
    expect(callsNamed(calls, 'fillText')).toStrictEqual([
      ['fillText', '20ms', 2, 1],
      ['fillText', '10ms', 2, 39]
    ]);
    expect(callsNamed(calls, 'set:fillStyle')).toStrictEqual([
      ['set:fillStyle', 'rgba(37, 99, 235, 0.12)'],
      ['set:fillStyle', 'rgba(226, 232, 240, 0.75)']
    ]);

    const plain = createCanvas();
    drawSparkline(plain.canvas, [5, 15], { yAxis: { color: '#eeeeee' } });
    expect(callsNamed(plain.calls, 'fillText')).toStrictEqual([
      ['fillText', '15', 2, 1],
      ['fillText', '5', 2, 39]
    ]);
    expect(callsNamed(plain.calls, 'set:fillStyle')).toContainEqual(['set:fillStyle', '#eeeeee']);
  });
});

describe('monitoringCharts drawRingGauge', () => {
  beforeEach(installFakeWindow);
  afterAll(removeFakeWindow);

  it('draws the track and the value arc, then centers the percent label', () => {
    expect.hasAssertions();
    const { canvas, calls } = createCanvas({ clientWidth: 100, clientHeight: 100 });
    drawRingGauge(canvas, 0.25);
    expect(callsNamed(calls, 'translate')).toStrictEqual([['translate', 50, 50]]);
    expect(callsNamed(calls, 'arc')).toStrictEqual([
      ['arc', 0, 0, 44, 0, Math.PI * 2],
      ['arc', 0, 0, 44, 0, Math.PI / 2]
    ]);
    expect(callsNamed(calls, 'set:strokeStyle')).toStrictEqual([
      ['set:strokeStyle', 'rgba(148, 163, 184, 0.35)'],
      ['set:strokeStyle', '#2563eb']
    ]);
    expect(callsNamed(calls, 'fillText')).toStrictEqual([['fillText', '25%', 50, 50]]);
    expect(callsNamed(calls, 'save')).toHaveLength(1);
    expect(callsNamed(calls, 'restore')).toHaveLength(1);
  });

  it('clamps the ratio into 0..1 and honors custom paint and label options', () => {
    expect.hasAssertions();
    const over = createCanvas({ clientWidth: 100, clientHeight: 100 });
    drawRingGauge(over.canvas, 1.4, {
      track: '#111111', color: '#ff0000', labelColor: '#00ff00', label: 'busy'
    });
    expect(callsNamed(over.calls, 'arc')).toStrictEqual([
      ['arc', 0, 0, 44, 0, Math.PI * 2],
      ['arc', 0, 0, 44, 0, Math.PI * 2]
    ]);
    expect(callsNamed(over.calls, 'set:strokeStyle')).toStrictEqual([
      ['set:strokeStyle', '#111111'],
      ['set:strokeStyle', '#ff0000']
    ]);
    expect(callsNamed(over.calls, 'set:fillStyle')).toStrictEqual([['set:fillStyle', '#00ff00']]);
    expect(callsNamed(over.calls, 'fillText')).toStrictEqual([['fillText', 'busy', 50, 50]]);

    const invalid = createCanvas({ clientWidth: 100, clientHeight: 100 });
    drawRingGauge(invalid.canvas, Number.NaN);
    expect(callsNamed(invalid.calls, 'arc')[1]).toStrictEqual(['arc', 0, 0, 44, 0, 0]);
    expect(callsNamed(invalid.calls, 'fillText')).toStrictEqual([['fillText', '0%', 50, 50]]);
  });
});

describe('monitoringCharts drawStackedArea', () => {
  beforeEach(installFakeWindow);
  afterAll(removeFakeWindow);

  it('stacks each series on the previous one using the shared palette', () => {
    expect.hasAssertions();
    const { canvas, calls } = createCanvas();
    drawStackedArea(canvas, { alpha: [1, 2], beta: [3, 4] });
    // totals are [4, 6], so y maps 0..6 onto 40..0.
    expect(callsNamed(calls, 'moveTo')).toStrictEqual([
      ['moveTo', 0, 40 - (1 / 6) * 40],
      ['moveTo', 0, 40 - (4 / 6) * 40]
    ]);
    expect(callsNamed(calls, 'lineTo').slice(0, 3)).toStrictEqual([
      ['lineTo', 100, 40 - (2 / 6) * 40],
      ['lineTo', 100, 40],
      ['lineTo', 0, 40]
    ]);
    expect(callsNamed(calls, 'lineTo').slice(3)).toStrictEqual([
      ['lineTo', 100, 0],
      ['lineTo', 100, 40 - (2 / 6) * 40],
      ['lineTo', 0, 40 - (1 / 6) * 40]
    ]);
    expect(callsNamed(calls, 'set:fillStyle')).toStrictEqual([
      ['set:fillStyle', STACK_PALETTE[0]],
      ['set:fillStyle', STACK_PALETTE[1]]
    ]);
    expect(callsNamed(calls, 'set:globalAlpha')).toStrictEqual([
      ['set:globalAlpha', 0.55],
      ['set:globalAlpha', 1],
      ['set:globalAlpha', 0.55],
      ['set:globalAlpha', 1]
    ]);
  });

  it('treats a null series as zeros instead of throwing', () => {
    expect.hasAssertions();
    const { canvas, calls } = createCanvas();
    expect(() => drawStackedArea(canvas, { alpha: [1, 2], beta: null })).not.toThrow();
    // totals are [1, 2]: the null series contributes nothing and stacks on
    // top of alpha, so both areas reach the same height.
    expect(callsNamed(calls, 'moveTo')).toStrictEqual([
      ['moveTo', 0, 40 - (1 / 2) * 40],
      ['moveTo', 0, 40 - (1 / 2) * 40]
    ]);
  });

  it('scales to a unit ceiling when every total is zero and accepts custom colors', () => {
    expect.hasAssertions();
    const { canvas, calls } = createCanvas();
    drawStackedArea(canvas, { alpha: [0, 0], beta: [] }, { colors: ['#aaaaaa', '#bbbbbb'] });
    expect(callsNamed(calls, 'moveTo')).toStrictEqual([
      ['moveTo', 0, 40],
      ['moveTo', 0, 40]
    ]);
    expect(callsNamed(calls, 'set:fillStyle')).toStrictEqual([
      ['set:fillStyle', '#aaaaaa'],
      ['set:fillStyle', '#bbbbbb']
    ]);
  });

  it('skips empty maps and windows shorter than two samples', () => {
    expect.hasAssertions();
    const empty = createCanvas();
    drawStackedArea(empty.canvas, {});
    expect(callsNamed(empty.calls, 'fill')).toHaveLength(0);

    const short = createCanvas();
    drawStackedArea(short.canvas, { alpha: [5] });
    expect(callsNamed(short.calls, 'fill')).toHaveLength(0);

    drawStackedArea(null, { alpha: [1, 2] });
    expect(callsNamed(short.calls, 'fill')).toHaveLength(0);
  });
});

describe('monitoringCharts drawStatusBars', () => {
  beforeEach(installFakeWindow);
  afterAll(removeFakeWindow);

  it('draws a donut slice per non-zero status with its count at the centroid', () => {
    expect.hasAssertions();
    const { canvas, calls } = createCanvas({ clientWidth: 100, clientHeight: 100 });
    drawStatusBars(canvas, { online: 2, stopped: 1, errored: 0 });
    expect(callsNamed(calls, 'arc')).toStrictEqual([
      ['arc', 0, 0, 46, 0, (4 / 3) * Math.PI],
      ['arc', 0, 0, 46, (4 / 3) * Math.PI, Math.PI * 2]
    ]);
    // slices are painted first, then the count labels on top.
    expect(callsNamed(calls, 'set:fillStyle')).toStrictEqual([
      ['set:fillStyle', colorForStatus('online')],
      ['set:fillStyle', colorForStatus('stopped')],
      ['set:fillStyle', '#f8fafc'],
      ['set:fillStyle', '#f8fafc']
    ]);
    const labels = callsNamed(calls, 'fillText').map((call) => call[1]);
    expect(labels).toStrictEqual(['2', '1']);
  });

  it('skips the chart when no status has a positive count', () => {
    expect.hasAssertions();
    const { canvas, calls } = createCanvas();
    drawStatusBars(canvas, { online: 0, errored: -1 });
    expect(callsNamed(calls, 'arc')).toHaveLength(0);
    drawStatusBars(canvas, null);
    expect(callsNamed(calls, 'arc')).toHaveLength(0);
    drawStatusBars(null, { online: 1 });
    expect(callsNamed(calls, 'arc')).toHaveLength(0);
  });
});

describe('monitoringCharts drawCoreBars', () => {
  beforeEach(installFakeWindow);
  afterAll(removeFakeWindow);

  it('draws one bar per core, red above 85% and blue otherwise', () => {
    expect.hasAssertions();
    const { canvas, calls } = createCanvas();
    drawCoreBars(canvas, [25, 100]);
    // y maps 0..100 onto 38..2, so 25 -> 29 and 100 -> 2.
    expect(callsNamed(calls, 'fillRect')).toStrictEqual([
      ['fillRect', 1, 29, 48, 11],
      ['fillRect', 51, 2, 48, 38]
    ]);
    expect(callsNamed(calls, 'set:fillStyle')).toStrictEqual([
      ['set:fillStyle', '#2563eb'],
      ['set:fillStyle', '#dc2626']
    ]);
  });

  it('clamps out-of-range core values and skips empty input', () => {
    expect.hasAssertions();
    const { canvas, calls } = createCanvas({ clientWidth: 100, clientHeight: 40 });
    drawCoreBars(canvas, [150, -20]);
    // 150 clamps to 100 (full-height bar), -20 clamps to 0 (2px floor).
    expect(callsNamed(calls, 'fillRect')).toStrictEqual([
      ['fillRect', 1, 2, 48, 38],
      ['fillRect', 51, 38, 48, 2]
    ]);

    const empty = createCanvas();
    drawCoreBars(empty.canvas, []);
    expect(callsNamed(empty.calls, 'fillRect')).toHaveLength(0);
    drawCoreBars(empty.canvas, null);
    expect(callsNamed(empty.calls, 'fillRect')).toHaveLength(0);
  });
});

describe('monitoringCharts drawMemoryBreakdown', () => {
  beforeEach(installFakeWindow);
  afterAll(removeFakeWindow);

  it('sizes rss/other/free segments proportionally across the bar', () => {
    expect.hasAssertions();
    const { canvas, calls } = createCanvas({ clientWidth: 100, clientHeight: 40 });
    drawMemoryBreakdown(canvas, { rss: 50, other: 30, free: 20 });
    expect(callsNamed(calls, 'fillRect')).toStrictEqual([
      ['fillRect', 0, 8, 50, 24],
      ['fillRect', 50, 8, 30, 24],
      ['fillRect', 80, 8, 20, 24]
    ]);
    expect(callsNamed(calls, 'set:fillStyle')).toStrictEqual([
      ['set:fillStyle', '#7c3aed'],
      ['set:fillStyle', '#2563eb'],
      ['set:fillStyle', '#334155']
    ]);
  });

  it('degenerates to zero-width segments on a unit scale when parts are missing', () => {
    expect.hasAssertions();
    const { canvas, calls } = createCanvas();
    drawMemoryBreakdown(canvas, undefined);
    expect(callsNamed(calls, 'fillRect')).toStrictEqual([
      ['fillRect', 0, 8, 0, 24],
      ['fillRect', 0, 8, 0, 24],
      ['fillRect', 0, 8, 0, 24]
    ]);
  });
});

describe('monitoringCharts drawDiskBars', () => {
  beforeEach(installFakeWindow);
  afterAll(removeFakeWindow);

  it('draws a track and a usage bar per healthy volume, red above 90%', () => {
    expect.hasAssertions();
    const { canvas, calls } = createCanvas({ clientWidth: 200, clientHeight: 40 });
    drawDiskBars(canvas, [
      { path: '/', usedPercent: 95 },
      { path: '/data', usedPercent: 40 },
      { path: '/broken', error: true, usedPercent: 100 }
    ]);
    expect(callsNamed(calls, 'fillRect')).toStrictEqual([
      ['fillRect', 0, 4, 200, 12],
      ['fillRect', 0, 4, 190, 12],
      ['fillRect', 0, 24, 200, 12],
      ['fillRect', 0, 24, 80, 12]
    ]);
    expect(callsNamed(calls, 'set:fillStyle')).toStrictEqual([
      ['set:fillStyle', '#1e293b'],
      ['set:fillStyle', '#dc2626'],
      ['set:fillStyle', '#e2e8f0'],
      ['set:fillStyle', '#1e293b'],
      ['set:fillStyle', '#059669'],
      ['set:fillStyle', '#e2e8f0']
    ]);
    expect(callsNamed(calls, 'fillText')).toStrictEqual([
      ['fillText', '/ 95%', 4, 12],
      ['fillText', '/data 40%', 4, 32]
    ]);
  });

  it('clamps missing or extreme usage and skips lists without healthy volumes', () => {
    expect.hasAssertions();
    const { canvas, calls } = createCanvas({ clientWidth: 100, clientHeight: 10 });
    drawDiskBars(canvas, [{ path: '/x' }]);
    expect(callsNamed(calls, 'fillRect')).toStrictEqual([
      ['fillRect', 0, 4, 100, 2],
      ['fillRect', 0, 4, 0, 2]
    ]);
    expect(callsNamed(calls, 'fillText')).toStrictEqual([['fillText', '/x 0%', 4, 2]]);

    const empty = createCanvas();
    drawDiskBars(empty.canvas, [{ path: '/bad', error: true }]);
    expect(callsNamed(empty.calls, 'fillRect')).toHaveLength(0);
    drawDiskBars(empty.canvas, null);
    expect(callsNamed(empty.calls, 'fillRect')).toHaveLength(0);
  });
});

describe('monitoringCharts status/palette edge branches', () => {
  beforeEach(installFakeWindow);
  afterAll(removeFakeWindow);

  it('maps every PM2 status family to its color with a gray fallback', () => {
    expect.hasAssertions();
    expect(colorForStatus('stopping')).toBe('#c9a227');
    expect(colorForStatus('launching')).toBe('#c9a227');
    expect(colorForStatus('stopped')).toBe('#6b7280');
    expect(colorForStatus('ONLINE')).toBe('#1f9d55');
    expect(colorForStatus('anything-else')).toBe('#9ca3af');
    expect(colorForStatus(undefined)).toBe('#9ca3af');
  });

  it('falls back to the shared palette and tolerates non-array series', () => {
    expect.hasAssertions();
    expect(stackColorAt(2, [])).toBe(STACK_PALETTE[2]);
    expect(stackColorAt(1, null as unknown as string[])).toBe(STACK_PALETTE[1]);
    const entries = legendEntriesForStack({ a: 'nope' }, { colors: ['#123456'] });
    expect(entries).toStrictEqual([{ name: 'a', color: '#123456', current: 0 }]);
    expect(legendEntriesForStack(null)).toStrictEqual([]);
  });

  it('treats a non-positive sample interval as one second in throughput', () => {
    expect.hasAssertions();
    expect(computeWindowThroughput([100, 300], 0)).toBe(200);
    expect(computeWindowThroughput([100, 300], Number.NaN)).toBe(200);
    expect(computeWindowThroughput(null as unknown as number[], 1)).toBeNull();
  });

  it('uses the default formatter and default interval when options are omitted', () => {
    expect.hasAssertions();
    expect(formatSeriesSummary([5, 9])).toBe('now 9 · min 5 · max 9');
    expect(computeWindowThroughput([100, 300])).toBe(200);
  });

  it('draws the sparkline baseline and skips the stack for non-array input', () => {
    expect.hasAssertions();
    const flat = createCanvas();
    drawSparkline(flat.canvas, null as unknown as number[]);
    expect(callsNamed(flat.calls, 'moveTo')).toStrictEqual([['moveTo', 0, 20]]);
    expect(callsNamed(flat.calls, 'stroke')).toHaveLength(1);

    const noMap = createCanvas();
    drawStackedArea(noMap.canvas, null);
    expect(callsNamed(noMap.calls, 'fill')).toHaveLength(0);

    const nullSeries = createCanvas();
    drawStackedArea(nullSeries.canvas, { only: null as unknown as number[] });
    expect(callsNamed(nullSeries.calls, 'fill')).toHaveLength(0);
  });
});
