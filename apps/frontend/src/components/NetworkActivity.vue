<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import {
  CBadge,
  CDropdown,
  CDropdownItem,
  CDropdownMenu,
  CDropdownToggle,
  CSpinner
} from '@coreui/vue';

import { useNetworkStore } from '@/stores/network';

const network = useNetworkStore();

onMounted(() => network.start());
onUnmounted(() => network.stop());

const statusColor = (ok: boolean, status?: number): string => {
  if (ok) return 'success';
  return status && status < 500 ? 'warning' : 'danger';
};
</script>

<template>
  <CDropdown variant="nav-item" placement="bottom-end" aria-label="Network activity">
    <CDropdownToggle :caret="false">
      <span class="position-relative d-inline-flex align-items-center">
        <CSpinner v-if="network.inFlight > 0" color="primary" size="sm" aria-label="Requests in flight" />
        <CIcon v-else icon="cil-cloud-download" size="lg" />
        <CBadge
          v-if="network.inFlight > 0"
          color="primary"
          shape="rounded-pill"
          class="position-absolute top-0 start-100 translate-middle"
        >
          {{ network.inFlight }}
        </CBadge>
      </span>
    </CDropdownToggle>
    <CDropdownMenu class="pt-0" style="min-width: 22rem">
      <CDropdownItem
        v-if="network.recent.length === 0"
        disabled
        class="text-body-secondary"
      >
        Nenhuma requisição ainda nesta sessão.
      </CDropdownItem>
      <CDropdownItem
        v-for="(item, index) in network.recent"
        :key="`${item.operationId}-${index}`"
        class="d-flex align-items-center gap-2"
      >
        <CBadge :color="statusColor(item.ok, item.status)" shape="rounded-pill">
          {{ item.status ?? 'ERR' }}
        </CBadge>
        <span class="fw-semibold">{{ item.operationId }}</span>
        <span class="text-body-secondary small ms-auto">{{ item.durationMs ?? 0 }} ms</span>
      </CDropdownItem>
    </CDropdownMenu>
  </CDropdown>
</template>
