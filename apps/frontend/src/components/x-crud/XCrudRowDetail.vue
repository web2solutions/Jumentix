<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import {
  CNav,
  CNavItem,
  CTabContent,
  CTabPane,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow
} from '@coreui/vue';

import XCrudForm from '@/components/x-crud/XCrudForm.vue';
import type { XCrudEntityConfig } from '@/components/x-crud/xCrudTypes';
import type { FieldDescriptor } from '@/contracts/formSchema';

/**
 * XCrudRowDetail (JUM-772 redesign): card below the clicked row with tabs —
 * "${entity} Data" (scalars), one tab per array-of-objects field (emails,
 * phones, documents…) rendered as a clean readonly table, and "Edit"
 * (RBAC-gated). Close button on the right (X-SYNTH pattern).
 */
const props = defineProps<{
  config: XCrudEntityConfig;
  record: Record<string, unknown>;
  updateDescriptors: FieldDescriptor[];
  canUpdate: boolean;
  initialTab?: 'preview' | 'edit';
  referenceRestrictions?: Record<string, string[]>;
}>();

const emit = defineEmits<{
  submitUpdate: [body: Record<string, unknown>];
  close: [];
}>();

const isObjectArray = (value: unknown): value is Array<Record<string, unknown>> => (
  Array.isArray(value) && value.length > 0 && typeof value[0] === 'object' && value[0] !== null
);

/** Array-of-objects fields get an exclusive preview tab each (JUM-772). */
const arrayFields = computed(() => Object.entries(props.record)
  .filter(([, value]) => isObjectArray(value))
  .map(([name, value]) => ({
    name,
    label: props.config.columnLabels?.[name] ?? name,
    items: value as Array<Record<string, unknown>>
  })));

/** The main tab carries scalars and scalar arrays only. */
const scalarRecord = computed(() => Object.fromEntries(
  Object.entries(props.record).filter(([, value]) => !isObjectArray(value))
));

const itemKeys = (items: Array<Record<string, unknown>>): string[] => [
  ...new Set(items.flatMap((item) => Object.keys(item).filter((key) => key !== 'id')))
];

const activeTab = ref<string>('preview');
watch(
  () => [props.record, props.initialTab],
  () => {
    activeTab.value = props.initialTab === 'edit' && props.canUpdate ? 'edit' : 'preview';
  },
  { immediate: true }
);
</script>

<template>
  <div class="card xcrud-row-detail border-start border-3 border-primary my-2">
    <div class="card-header d-flex align-items-center py-1">
      <CNav variant="underline" role="tablist" class="border-0">
        <CNavItem>
          <a
            class="nav-link"
            href="#"
            :class="{ active: activeTab === 'preview' }"
            @click.prevent="activeTab = 'preview'"
          >
            {{ config.title }} Data
          </a>
        </CNavItem>
        <CNavItem v-for="field in arrayFields" :key="field.name">
          <a
            class="nav-link text-capitalize"
            href="#"
            :class="{ active: activeTab === field.name }"
            @click.prevent="activeTab = field.name"
          >
            {{ field.label }}
          </a>
        </CNavItem>
        <CNavItem v-if="canUpdate">
          <a
            class="nav-link"
            href="#"
            :class="{ active: activeTab === 'edit' }"
            @click.prevent="activeTab = 'edit'"
          >
            Edit {{ config.title }}
          </a>
        </CNavItem>
      </CNav>
      <button type="button" class="btn-close ms-auto" aria-label="Close" @click="emit('close')" />
    </div>
    <div class="card-body">
      <CTabContent>
        <CTabPane :visible="activeTab === 'preview'">
          <XCrudForm :config="config" mode="preview" :descriptors="[]" :record="scalarRecord" />
        </CTabPane>
        <CTabPane v-for="field in arrayFields" :key="field.name" :visible="activeTab === field.name">
          <CTable striped hover align="middle" class="mb-0">
            <CTableHead>
              <CTableRow>
                <CTableHeaderCell
                  v-for="key in itemKeys(field.items)"
                  :key="key"
                  class="small text-uppercase text-body-secondary"
                >
                  {{ key }}
                </CTableHeaderCell>
              </CTableRow>
            </CTableHead>
            <CTableBody>
              <CTableRow v-for="(item, index) in field.items" :key="index">
                <CTableDataCell v-for="key in itemKeys(field.items)" :key="key">
                  {{ item[key] ?? '—' }}
                </CTableDataCell>
              </CTableRow>
            </CTableBody>
          </CTable>
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
