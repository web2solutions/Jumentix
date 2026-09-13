<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { CCard, CCardBody, CCardHeader, CNav, CNavItem } from '@coreui/vue';

import XCrudForm from '@/components/x-crud/XCrudForm.vue';
import XCrudGrid from '@/components/x-crud/XCrudGrid.vue';
import XCrudPanels from '@/components/x-crud/XCrudPanels.vue';
import XCrudRowDetail from '@/components/x-crud/XCrudRowDetail.vue';
import XCrudToolbar from '@/components/x-crud/XCrudToolbar.vue';
import { useXCrud } from '@/components/x-crud/useXCrud';
import type { XCrudEntityConfig } from '@/components/x-crud/xCrudTypes';
import { usePermissions } from '@/contracts/usePermissions';
import { t } from '@/i18n';

/**
 * XCrud (JUM-772 redesign, X-SYNTH pattern): one card; pills "New ${entity} |
 * ${entity} Listing" in the card header; aggregates render as widgets on top
 * of the listing; RBAC gates every affordance (scopes read from the OAS).
 */
const props = defineProps<{
  config: XCrudEntityConfig;
  canUpdateRow?: (row: Record<string, unknown>) => boolean;
  canDeleteRow?: (row: Record<string, unknown>) => boolean;
  referenceRestrictions?: Record<string, string[]>;
}>();

const crud = useXCrud(props.config);
const permissions = usePermissions();

const view = ref<'listing' | 'new'>('listing');
const detailTab = ref<'preview' | 'edit'>('preview');
const filtersOpen = ref(false);

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

const submitCreate = async (body: Record<string, unknown>): Promise<void> => {
  await crud.submitCreate(body);
  if (!crud.errorMessage.value) view.value = 'listing';
};

const submitRowUpdate = async (body: Record<string, unknown>): Promise<void> => {
  if (!crud.expandedId.value) return;
  await crud.submitUpdate(crud.expandedId.value, body);
};

onMounted(async () => {
  await permissions.ensure();
  await Promise.all([crud.load(), crud.loadReferences()]);
});
</script>

<template>
  <CCard class="border-0 shadow-sm xcrud">
    <CCardHeader class="bg-transparent">
      <CNav variant="pills" role="tablist">
        <CNavItem v-if="canCreate">
          <a
            class="nav-link"
            href="#"
            :class="{ active: view === 'new' }"
            @click.prevent="view = 'new'"
          >
            {{ t('crud.new', { entity: crud.title.value }) }}
          </a>
        </CNavItem>
        <CNavItem>
          <a
            class="nav-link"
            href="#"
            :class="{ active: view === 'listing' }"
            @click.prevent="view = 'listing'"
          >
            {{ t('crud.listing', { entity: crud.title.value }) }}
          </a>
        </CNavItem>
      </CNav>
    </CCardHeader>
    <CCardBody>
      <div v-if="crud.errorMessage.value" class="alert alert-danger" role="alert">
        {{ crud.errorMessage.value }}
      </div>
      <div v-if="crud.notice.value" class="alert alert-success" role="alert">
        {{ crud.notice.value }}
      </div>

      <template v-if="view === 'listing'">
        <XCrudPanels v-if="(config.aggregates ?? []).length" :crud="crud" />
        <XCrudToolbar v-model:filters-open="filtersOpen" :crud="crud" />
        <XCrudGrid
          :crud="crud"
          :can-update="canUpdateRow"
          :can-delete="canDeleteRow"
          :show-filters="filtersOpen"
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
              :reference-labels="crud.referenceLabels"
              @submit-update="submitRowUpdate"
              @close="crud.toggleExpanded(crud.rowId(row))"
            />
          </template>
        </XCrudGrid>
      </template>

      <template v-else>
        <h5 class="mb-3">{{ t('crud.new', { entity: crud.title.value }) }}</h5>
        <XCrudForm
          :config="config"
          mode="create"
          :descriptors="crud.createDescriptors"
          :reference-restrictions="referenceRestrictions"
          @submit="submitCreate"
          @cancel="view = 'listing'"
        />
      </template>
    </CCardBody>
  </CCard>
</template>
