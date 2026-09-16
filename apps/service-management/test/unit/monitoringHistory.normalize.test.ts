/* eslint-disable jest/prefer-expect-assertions, jest/prefer-strict-equal, jest/max-expects */
import {
  normalizeMonitoringHistoryInput,
  createEmptyMonitoringHistory
} from '@jumentix/designer-core/state/designerState.js';

describe('normalizeMonitoringHistoryInput', () => {
  it('normalizes empty payloads and clamps process spark series', () => {
    expect.hasAssertions();
    expect(normalizeMonitoringHistoryInput(undefined))
      .toStrictEqual(createEmptyMonitoringHistory());
    const normalized = normalizeMonitoringHistoryInput({
      environment: 'staging',
      samples: Array.from({ length: 80 }, (_, index) => ({
        t: `t-${index}`,
        cpuTotal: index,
        memTotal: index * 2,
        onlineRatio: 1,
        asyncActiveSum: 0,
        hostCpu: 10,
        hostMemUsedPercent: 20
      })),
      processes: {
        'default::app': {
          cpu: Array.from({ length: 70 }, (_, index) => index),
          mem: [1, 2, 3],
          restarts: [],
          asyncActive: [],
          diskReadBytes: [9],
          diskWriteBytes: [8]
        }
      }
    });
    expect(normalized.environment).toBe('staging');
    expect(normalized.samples).toHaveLength(60);
    const processHistory = (normalized.processes as Record<string, { cpu: number[]; diskReadBytes: number[] }>)['default::app'];
    expect(processHistory.cpu).toHaveLength(60);
    expect(processHistory.diskReadBytes).toStrictEqual([9]);
  });
});

describe('normalizeMonitoringHistoryInput malformed entries (JUM-821)', () => {
  it('maps unreadable sample metrics to null/0 instead of NaN, and tolerates null samples', () => {
    expect.hasAssertions();
    const normalized = normalizeMonitoringHistoryInput({
      samples: [
        null,
        {
          t: 't-bad',
          hostCpu: 'hot',
          hostMemUsedPercent: undefined,
          cpuTotal: 'not-a-number',
          memTotal: 0,
          onlineRatio: undefined,
          asyncActiveSum: 0
        }
      ]
    });

    // A null sample survives as an all-default reading, not as a crash.
    expect(normalized.samples[0]).toStrictEqual({
      t: '',
      hostCpu: null,
      hostMemUsedPercent: null,
      cpuTotal: 0,
      memTotal: 0,
      onlineRatio: 0,
      asyncActiveSum: 0
    });
    // Percentages that are not numbers read as "unknown" (null); totals fall to 0.
    expect(normalized.samples[1]).toStrictEqual({
      t: 't-bad',
      hostCpu: null,
      hostMemUsedPercent: null,
      cpuTotal: 0,
      memTotal: 0,
      onlineRatio: 0,
      asyncActiveSum: 0
    });
  });

  it('skips blank process names and clamps non-array series to empty', () => {
    expect.hasAssertions();
    const normalized = normalizeMonitoringHistoryInput({
      processes: {
        // A blank key is not a process name; keeping it would draw a row with
        // no label in the monitoring view.
        '': {
          cpu: [1], mem: [2], restarts: [], asyncActive: [], diskReadBytes: [], diskWriteBytes: []
        },
        'default::api': {
          cpu: 'not-an-array',
          mem: [1, 'x', 3],
          restarts: undefined,
          asyncActive: null,
          diskReadBytes: [9],
          diskWriteBytes: [8]
        }
      }
    });

    expect(Object.keys(normalized.processes)).toStrictEqual(['default::api']);
    const bucket = (normalized.processes as Record<string, Record<string, number[]>>)['default::api'];
    // A series that is not an array clamps to empty; non-finite entries drop out.
    expect(bucket.cpu).toStrictEqual([]);
    expect(bucket.mem).toStrictEqual([1, 3]);
    expect(bucket.restarts).toStrictEqual([]);
    expect(bucket.asyncActive).toStrictEqual([]);
    expect(bucket.diskReadBytes).toStrictEqual([9]);
  });
});
