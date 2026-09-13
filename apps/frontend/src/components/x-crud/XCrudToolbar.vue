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
import { fieldLabel } from '@/contracts/labels';
import { listCapabilities } from '@/contracts/listSchema';
import { localized, t } from '@/i18n';
import { useAuthStore } from '@/stores/auth';

import type { useXCrud } from './useXCrud';

/**
 * XCrudToolbar (JUM-772 redesign, X-SYNTH pattern): search, quick context
 * filter, Filters toggle (JUM-781: a labelled button, not a hidden checkbox),
 * bulk delete with selection count, Export, Columns visibility, Refresh —
 * compact outline buttons with cil icons. Search renders only when the
 * contract declares searchable fields (JUM-778).
 */
const props = defineProps<{
  crud: ReturnType<typeof useXCrud>;
  filtersOpen: boolean;
}>();

const emit = defineEmits<{ 'update:filtersOpen': [value: boolean] }>();

const quickOptions = ref<Array<{ value: string; label: string }>>([]);

onMounted(async () => {
  const quick = props.crud.config.quickFilter;
  if (!quick?.optionsOperationId) return;
  try {
    const auth = useAuthStore();
    const capabilities = listCapabilities(quick.optionsOperationId);
    const response = await getSharedApiClient().request<{ result?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>>({
      operationId: quick.optionsOperationId,
      query: capabilities ? { page: 1, size: capabilities.maxSize } : undefined,
      headers: { Authorization: auth.token }
    });
    const rows = Array.isArray(response) ? response : (response.result ?? []);
    quickOptions.value = rows.map((row) => ({
      value: String(row.id),
      label: String(row.name ?? row.id)
    }));
  } catch {
    quickOptions.value = [];
  }
});

const selectedCount = computed(() => props.crud.selected.value.size);
const bulkEnabled = computed(() => selectedCount.value > 0);
const activeFilterCount = computed(() => Object.keys(props.crud.filters).length);
const counter = computed(() => (
  props.crud.serverMode
    ? t('crud.recordsOf', { count: props.crud.rows.value.length, total: props.crud.total.value })
    : t('crud.records', { count: props.crud.filteredRows.value.length })
));
</script>

<template>
  <div class="d-flex flex-wrap gap-2 align-items-center mb-3 xcrud-toolbar">
    <CInputGroup v-if="crud.canSearch.value" class="w-auto" size="sm">
      <CInputGroupText><CIcon icon="cil-search" size="sm" /></CInputGroupText>
      <CFormInput
        :model-value="crud.search.value"
        type="search"
        :placeholder="t('crud.search', { entity: crud.title.value })"
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
        { label: crud.config.quickFilter.allLabel ? localized(crud.config.quickFilter.allLabel) : t('app.all'), value: '' },
        ...quickOptions
      ]"
      @update:model-value="crud.setFilter(crud.config.quickFilter!.field, String($event))"
    />

    <CButton
      color="secondary"
      :variant="filtersOpen ? undefined : 'outline'"
      size="sm"
      :aria-pressed="filtersOpen"
      aria-label="toggle column filters"
      @click="emit('update:filtersOpen', !filtersOpen)"
    >
      <CIcon icon="cil-filter" size="sm" /> {{ t('crud.filters') }}{{ activeFilterCount ? ` (${activeFilterCount})` : '' }}
    </CButton>

    <CButton
      v-if="crud.config.bulkDelete !== false"
      color="danger"
      variant="outline"
      size="sm"
      :disabled="!bulkEnabled"
      @click="crud.submitBulkDelete"
    >
      <CIcon icon="cil-trash" size="sm" />
      {{ selectedCount ? t('crud.deleteSelected', { count: selectedCount }) : t('crud.delete') }}
    </CButton>

    <CButton
      v-if="crud.config.exportable !== false"
      color="secondary"
      variant="outline"
      size="sm"
      @click="crud.exportJson"
    >
      <CIcon icon="cil-cloud-download" size="sm" /> {{ crud.serverMode ? t('crud.exportPage') : t('crud.exportJson') }}
    </CButton>

    <CDropdown variant="btn-group">
      <CDropdownToggle color="secondary" variant="outline" size="sm">
        <CIcon icon="cil-view-column" size="sm" /> {{ t('crud.columns') }}
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
          {{ fieldLabel(d, crud.config.columnLabels) }}
        </CDropdownItem>
      </CDropdownMenu>
    </CDropdown>

    <CButton color="secondary" variant="outline" size="sm" @click="crud.load">
      <CIcon icon="cil-reload" size="sm" /> {{ t('crud.refresh') }}
    </CButton>

    <span class="ms-auto text-body-secondary small">{{ counter }}</span>
  </div>
</template>
