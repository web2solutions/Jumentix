<script setup lang="ts">
import { CBadge, CDropdown, CDropdownHeader, CDropdownItem, CDropdownMenu, CDropdownToggle } from '@coreui/vue';
import { computed } from 'vue';

import { useNotificationStore } from '@/stores/notifications';
import { useI18n } from '@/i18n';

const { t } = useI18n();
const notifications = useNotificationStore();
const label = computed(() => (
  notifications.unread > 0
    ? t('notifications.unread', { count: notifications.unread })
    : t('notifications.title')
));
</script>

<template>
  <CDropdown variant="nav-item" placement="bottom-end">
    <CDropdownToggle :caret="false" class="py-0 pe-0" :aria-label="label">
      <span class="position-relative d-inline-flex align-items-center">
        <CIcon icon="cil-bell" size="lg" />
        <CBadge
          v-if="notifications.unread > 0"
          color="danger"
          position="top-end"
          shape="rounded-pill"
        >
          {{ notifications.unread }}
        </CBadge>
      </span>
    </CDropdownToggle>
    <CDropdownMenu class="pt-0" style="min-width: 18rem; max-height: 20rem; overflow: auto">
      <CDropdownHeader class="bg-body-secondary fw-semibold mb-2">
        {{ t('notifications.title') }}
      </CDropdownHeader>
      <CDropdownItem
        v-if="notifications.items.length === 0"
        component="span"
        class="text-body-secondary"
      >
        {{ t('notifications.empty') }}
      </CDropdownItem>
      <CDropdownItem
        v-for="item in notifications.items"
        :key="item.id"
        component="button"
        type="button"
        :class="{ 'fw-semibold': !item.read }"
        @click="item.reopen ? notifications.takeReopen(item.id) : notifications.markRead(item.id)"
      >
        <div>{{ item.title }}</div>
        <small class="text-body-secondary">{{ item.message }}</small>
        <div v-if="item.reopen" class="small text-primary">{{ t('notifications.reopen') }}</div>
      </CDropdownItem>
      <CDropdownItem
        v-if="notifications.items.length > 0"
        component="button"
        type="button"
        @click="notifications.markAllRead()"
      >
        {{ t('notifications.markAll') }}
      </CDropdownItem>
    </CDropdownMenu>
  </CDropdown>
</template>
