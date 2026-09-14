import AppHeaderDropdownAccnt from '@/components/AppHeaderDropdownAccnt.vue';
import NetworkActivity from '@/components/NetworkActivity.vue';
import LocaleWidget from '@/shell/LocaleWidget.vue';
import NotificationCenter from '@/shell/NotificationCenter.vue';
import OnlineOfflineWidget from '@/shell/OnlineOfflineWidget.vue';
import { registerToolbarWidget } from '@/shell/toolbarWidgets';

export const registerShellToolbarWidgets = (): void => {
  registerToolbarWidget({
    id: 'notifications',
    component: NotificationCenter,
    placement: 'right',
    order: 10
  });
  registerToolbarWidget({
    id: 'online-offline',
    component: OnlineOfflineWidget,
    placement: 'right',
    order: 15
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
