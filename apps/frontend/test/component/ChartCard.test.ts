import {
  afterEach, describe, expect, it
} from 'bun:test';

import ChartCard from '@/components/dashboard/ChartCard.vue';

import { flush, mountWithShell } from './support';

describe('ChartCard table fallback (JUM-812/813)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('exposes bucket numbers in the table fallback', async () => {
    expect.hasAssertions();
    const wrapper = mountWithShell(ChartCard, {
      props: {
        title: 'Roles',
        buckets: [
          { key: 'admin', count: 2 },
          { key: 'user', count: 4 }
        ]
      },
      global: { stubs: { ChartCard: false, CChart: { template: '<div class="chart-stub" />' } } }
    });
    await flush(1);
    const table = wrapper.find('[data-chart-table]');
    expect(table.text()).toContain('2');
    expect(table.text()).toContain('4');
    expect(table.text()).toContain('admin');
    await wrapper.find('[data-chart-table-toggle]').trigger('click');
    await flush(1);
    expect(wrapper.find('[data-chart-table]').classes()).not.toContain('visually-hidden');
    wrapper.unmount();
  });
});
