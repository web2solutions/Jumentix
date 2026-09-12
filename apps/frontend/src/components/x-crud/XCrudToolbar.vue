<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import {
  CButton,
  CDropdown,
  CDropdownItem,
  CDropdownMenu,
  CDropdownToggle,
  CFormInput,
  CFormSelect,
  CInputGroup,
  CInputGroupText
} from '@coreui/vue';

import { getSharedApiClient } from '@/contracts/apiClient';
import { useAuthStore } from '@/stores/auth';

import type { useXCrud } from './useXCrud';

/**
 * XCrudToolbar (JUM-772 redesign, X-SYNTH pattern): search, quick context
 * filter, bulk delete with selection count, Export JSON, Columns visibility,
 * Refresh — all compact outline buttons with cil icons.
 */
const props = defineProps<{ crud: ReturnType<typeof useXCrud> }>();

const quickOptions = ref<Array<{ value: string; label: string }>>([]);

onMounted(async () => {
  const quick = props.crud.config.quickFilter;
  if (!quick?.optionsOperationId) return;
  try {
    const auth = useAuthStore();
    const response = await getSharedApiClient().request<{ result?: Array<Record<string, unknown>> }>({
      operationId: quick.optionsOperationId,
      headers: { Authorization: auth.token }
    });
    quickOptions.value = (response.result ?? []).map((row) => ({
      value: String(row.id),
      label: String(row.name ?? row.id)
    }));
  } catch {
    quickOptions.value = [];
  }
});

const selectedCount = computed(() => props.crud.selected.value.size);
const bulkEnabled = computed(() => selectedCount.value > 0);
</script>

<template>
  <div class="d-flex flex-wrap gap-2 align-items-center mb-3 xcrud-toolbar">
    <CInputGroup class="w-auto" size="sm">
      <CInputGroupText><CIcon icon="cil-search" size="sm" /></CInputGroupText>
      <CFormInput
        :model-value="crud.search.value"
        type="search"
        :placeholder="`Search ${crud.config.title.toLowerCase()}s…`"
        aria-label="search"
        @update:model-value="crud.setSearch(String($event))"
      />
    </CInputGroup>

    <CFormSelect
      v-if="crud.config.quickFilter"
      size="sm"
      class="w-auto"
      :aria-label="crud.config.quickFilter.field"
      :model-value="String(crud.filters[crud.config.quickFilter.field] ?? '')"
      :options="[
        { label: crud.config.quickFilter.allLabel ?? 'All', value: '' },
        ...quickOptions
      ]"
      @update:model-value="crud.setFilter(crud.config.quickFilter!.field, String($event))"
    />

    <CButton
      v-if="crud.config.bulkDelete !== false"
      color="danger"
      variant="outline"
      size="sm"
      :disabled="!bulkEnabled"
      @click="crud.submitBulkDelete"
    >
      <CIcon icon="cil-trash" size="sm" /> Delete{{ selectedCount ? ` (${selectedCount})` : '' }}
    </CButton>

    <CButton
      v-if="crud.config.exportable !== false"
      color="secondary"
      variant="outline"
      size="sm"
      @click="crud.exportJson"
    >
      <CIcon icon="cil-cloud-download" size="sm" /> Export JSON
    </CButton>

    <CDropdown variant="btn-group">
      <CDropdownToggle color="secondary" variant="outline" size="sm">
        <CIcon icon="cil-view-column" size="sm" /> Columns
      </CDropdownToggle>
      <CDropdownMenu>
        <CDropdownItem
          v-for="d in crud.columns"
          :key="d.name"
          component="button"
          @click="crud.toggleColumn(d.name)"
        >
          <CIcon
            :icon="crud.hiddenColumns.includes(d.name) ? 'cil-square' : 'cil-check'"
            size="sm"
            class="me-1"
          />
          {{ crud.config.columnLabels?.[d.name] ?? d.description ?? d.name }}
        </CDropdownItem>
      </CDropdownMenu>
    </CDropdown>

    <CButton color="secondary" variant="outline" size="sm" @click="crud.load">
      <CIcon icon="cil-reload" size="sm" /> Refresh
    </CButton>

    <span class="ms-auto text-body-secondary small">
      {{ crud.filteredRows.value.length }} registro(s)
    </span>
  </div>
</template>
