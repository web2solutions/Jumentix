/* eslint-disable jest/prefer-expect-assertions, jest/prefer-strict-equal */
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
