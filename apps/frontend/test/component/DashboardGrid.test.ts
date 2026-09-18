import {
  afterEach, describe, expect, it
} from 'bun:test';
import { defineComponent } from 'vue';

import DashboardGrid from '@/components/dashboard/DashboardGrid.vue';
import type { DashboardWidget } from '@/components/dashboard/types';

import { flush, mountWithShell } from './support';

const Stub = defineComponent({
  props: { widget: { type: Object, required: true } },
  template: '<div class="stub-body">{{ widget.id }}</div>'
});

describe('DashboardGrid (JUM-811)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders widgets from a manifest fixture in declaration order and sizes', async () => {
    expect.hasAssertions();
    const widgets: DashboardWidget[] = [
      {
        id: 'alpha', title: { en: 'Alpha' }, size: 'sm', component: Stub
      },
      {
        id: 'beta', title: { en: 'Beta' }, size: 'lg', component: Stub
      }
    ];
    const wrapper = mountWithShell(DashboardGrid, { props: { widgets } });
    await flush(1);
    const cards = wrapper.findAll('[data-widget-card]');
    expect(cards.map((card) => card.attributes('data-widget-card'))).toStrictEqual(['alpha', 'beta']);
    expect(wrapper.find('[data-widget-size="sm"]').exists()).toBe(true);
    expect(wrapper.find('[data-widget-size="lg"]').exists()).toBe(true);
    expect(wrapper.find('.stub-body').text()).toContain('alpha');
    await wrapper.find('button[aria-expanded]').trigger('click');
    await flush(1);
    expect(wrapper.find('button[aria-expanded="false"]').exists()).toBe(true);
    wrapper.unmount();
  });

  it('shows the empty state when the manifest has no widgets', async () => {
    expect.hasAssertions();
    const wrapper = mountWithShell(DashboardGrid, { props: { widgets: [] } });
    expect(wrapper.find('[data-dashboard-empty]').text()).toContain('No widgets');
    wrapper.unmount();
  });
});
