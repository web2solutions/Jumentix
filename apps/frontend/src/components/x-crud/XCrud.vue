<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { CNav, CNavItem, CTabContent, CTabPane } from '@coreui/vue';

import XCrudFilters from '@/components/x-crud/XCrudFilters.vue';
import XCrudForm from '@/components/x-crud/XCrudForm.vue';
import XCrudGrid from '@/components/x-crud/XCrudGrid.vue';
import XCrudPanels from '@/components/x-crud/XCrudPanels.vue';
import XCrudRowDetail from '@/components/x-crud/XCrudRowDetail.vue';
import XCrudToolbar from '@/components/x-crud/XCrudToolbar.vue';
import { useXCrud } from '@/components/x-crud/useXCrud';
import type { XCrudEntityConfig } from '@/components/x-crud/xCrudTypes';
import { usePermissions } from '@/contracts/usePermissions';
import { useAuthStore } from '@/stores/auth';

/**
 * XCrud (JUM-772): tabbed shell — "List" (toolbar + filters + grid), "New
 * ${entity}" (create form, same hierarchy level as the grid, RBAC-gated) and
 * "Overview" (aggregate cards + chart). Tab switches preserve grid state.
 */
const props = defineProps<{
  config: XCrudEntityConfig;
  /** Per-row permission overrides (e.g. tenancy, self-protection). */
  canUpdateRow?: (row: Record<string, unknown>) => boolean;
  canDeleteRow?: (row: Record<string, unknown>) => boolean;
  referenceRestrictions?: Record<string, string[]>;
}>();

const crud = useXCrud(props.config);
const permissions = usePermissions();
const auth = useAuthStore();

const activeTab = ref<'list' | 'new' | 'overview'>('list');
const detailTab = ref<'preview' | 'edit'>('preview');

const canCreate = permissions.canOp(props.config.operations.create);
const canUpdateOp = permissions.canOp(props.config.operations.update);
const canDeleteOp = permissions.canOp(props.config.operations.delete);

const canUpdateRow = (row: Record<string, unknown>) => (
  canUpdateOp.value && (props.canUpdateRow ? props.canUpdateRow(row) : true)
);
const canDeleteRow = (row: Record<string, unknown>) => (
  canDeleteOp.value && (props.canDeleteRow ? props.canDeleteRow(row) : true)
);

const expand = (id: string, tab: 'preview' | 'edit'): void => {
  detailTab.value = tab;
  crud.toggleExpanded(id);
};

const expandedRow = () => crud.rows.value.find((row) => crud.rowId(row) === crud.expandedId.value);

const submitCreate = async (body: Record<string, unknown>): Promise<void> => {
  await crud.submitCreate(body);
  if (!crud.errorMessage.value) activeTab.value = 'list';
};

const submitRowUpdate = async (body: Record<string, unknown>): Promise<void> => {
  if (!crud.expandedId.value) return;
  await crud.submitUpdate(crud.expandedId.value, body);
};

onMounted(async () => {
  await permissions.ensure();
  await crud.load();
});
</script>

<template>
  <div class="xcrud">
    <CNav variant="tabs" role="tablist" class="mb-3">
      <CNavItem>
        <a class="nav-link" href="#" :class="{ active: activeTab === 'list' }" @click.prevent="activeTab = 'list'">
          List
        </a>
      </CNavItem>
      <CNavItem v-if="canCreate">
        <a class="nav-link" href="#" :class="{ active: activeTab === 'new' }" @click.prevent="activeTab = 'new'">
          New {{ config.title }}
        </a>
      </CNavItem>
      <CNavItem v-if="(config.aggregates ?? []).length">
        <a class="nav-link" href="#" :class="{ active: activeTab === 'overview' }" @click.prevent="activeTab = 'overview'">
          Overview
        </a>
      </CNavItem>
    </CNav>

    <div v-if="crud.errorMessage.value" class="alert alert-danger" role="alert">
      {{ crud.errorMessage.value }}
    </div>
    <div v-if="crud.notice.value" class="alert alert-success" role="alert">{{ crud.notice.value }}</div>

    <CTabContent>
      <CTabPane :visible="activeTab === 'list'">
        <XCrudToolbar
          :search="crud.search.value"
          @update:search="crud.setSearch"
        />
        <XCrudFilters
          :columns="crud.columns"
          :filters="crud.filters"
          @set-filter="crud.setFilter"
        />
        <div v-if="crud.loading.value" class="text-body-secondary">Carregando…</div>
        <XCrudGrid
          :crud="crud"
          :can-update="canUpdateRow"
          :can-delete="canDeleteRow"
          @expand="expand"
          @delete="crud.submitDelete"
          @inline-commit="crud.submitInline"
        >
          <template #detail="{ row }">
            <XCrudRowDetail
              :config="config"
              :record="row"
              :update-descriptors="crud.updateDescriptors"
              :can-update="canUpdateRow(row)"
              :initial-tab="detailTab"
              :reference-restrictions="referenceRestrictions"
              @submit-update="submitRowUpdate"
              @close="crud.toggleExpanded(crud.rowId(row))"
            />
          </template>
        </XCrudGrid>
      </CTabPane>

      <CTabPane v-if="canCreate" :visible="activeTab === 'new'">
        <h5 class="mb-3">New {{ config.title }}</h5>
        <XCrudForm
          :config="config"
          mode="create"
          :descriptors="crud.createDescriptors"
          :reference-restrictions="referenceRestrictions"
          @submit="submitCreate"
          @cancel="activeTab = 'list'"
        />
      </CTabPane>

      <CTabPane :visible="activeTab === 'overview'">
        <XCrudPanels :crud="crud" />
      </CTabPane>
    </CTabContent>
  </div>
</template>
