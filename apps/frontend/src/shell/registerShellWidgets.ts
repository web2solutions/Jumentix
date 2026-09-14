import AppHeaderDropdownAccnt from '@/components/AppHeaderDropdownAccnt.vue';
import NetworkActivity from '@/components/NetworkActivity.vue';
import LocaleWidget from '@/shell/LocaleWidget.vue';
import ReservedToolbarSlot from '@/shell/ReservedToolbarSlot.vue';
import { registerToolbarWidget } from '@/shell/toolbarWidgets';

export const registerShellToolbarWidgets = (): void => {
  registerToolbarWidget({
    id: 'notifications',
    component: ReservedToolbarSlot,
    placement: 'right',
    order: 10,
    props: { slotId: 'notifications' }
  });
  registerToolbarWidget({
    id: 'online-offline',
    component: ReservedToolbarSlot,
    placement: 'right',
    order: 15,
    props: { slotId: 'online-offline' }
  });
  registerToolbarWidget({
    id: 'locale',
    component: LocaleWidget,
    placement: 'right',
    order: 18
  });
  registerToolbarWidget({
    id: 'network',
    component: NetworkActivity,
    placement: 'right',
    order: 20
  });
  registerToolbarWidget({
    id: 'account',
    component: AppHeaderDropdownAccnt,
    placement: 'right',
    order: 30
  });
};
