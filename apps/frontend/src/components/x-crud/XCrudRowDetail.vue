<script setup lang="ts">
import { ref, watch } from 'vue';
import { CNav, CNavItem, CTabContent, CTabPane } from '@coreui/vue';

import XCrudForm from '@/components/x-crud/XCrudForm.vue';
import type { XCrudEntityConfig } from '@/components/x-crud/xCrudTypes';

/**
 * XCrudRowDetail (JUM-772): the special card expanding below the clicked row,
 * with its own tabbed layout — "Preview" (readonly full record, default) and
 * "Edit" (only when the RBAC scope allows update).
 */
const props = defineProps<{
  config: XCrudEntityConfig;
  record: Record<string, unknown>;
  updateDescriptors: import('@/contracts/formSchema').FieldDescriptor[];
  canUpdate: boolean;
  initialTab?: 'preview' | 'edit';
  referenceRestrictions?: Record<string, string[]>;
}>();

const emit = defineEmits<{
  submitUpdate: [body: Record<string, unknown>];
  close: [];
}>();

const activeTab = ref<'preview' | 'edit'>('preview');
watch(
  () => [props.record, props.initialTab],
  () => {
    activeTab.value = props.initialTab === 'edit' && props.canUpdate ? 'edit' : 'preview';
  },
  { immediate: true }
);
</script>

<template>
  <div class="card xcrud-row-detail my-2">
    <div class="card-header">
      <CNav variant="tabs" role="tablist">
        <CNavItem>
          <a class="nav-link"
            href="#"
            :class="{ active: activeTab === 'preview' }"
            @click.prevent="activeTab = 'preview'"
          >
            Preview
          </a>
        </CNavItem>
        <CNavItem v-if="canUpdate">
          <a class="nav-link"
            href="#"
            :class="{ active: activeTab === 'edit' }"
            @click.prevent="activeTab = 'edit'"
          >
            Edit
          </a>
        </CNavItem>
      </CNav>
      <button type="button" class="btn-close ms-auto" aria-label="Close" @click="emit('close')" />
    </div>
    <div class="card-body">
      <CTabContent>
        <CTabPane :visible="activeTab === 'preview'">
          <XCrudForm :config="config" mode="preview" :descriptors="[]" :record="record" />
        </CTabPane>
        <CTabPane v-if="canUpdate" :visible="activeTab === 'edit'">
          <XCrudForm
            :config="config"
            mode="update"
            :descriptors="updateDescriptors"
            :record="record"
            :reference-restrictions="referenceRestrictions"
            @submit="emit('submitUpdate', $event)"
            @cancel="activeTab = 'preview'"
          />
        </CTabPane>
      </CTabContent>
    </div>
  </div>
</template>
