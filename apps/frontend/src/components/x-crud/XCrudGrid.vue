<script setup lang="ts">
import { ref } from 'vue';
import {
  CFormInput,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow
} from '@coreui/vue';

import SearchableEnumInput from '@/components/SearchableEnumInput.vue';
import XCrudRowMenu from '@/components/x-crud/XCrudRowMenu.vue';
import { formatCellValue, isInlineEditable } from '@/components/x-crud/xCrudFormat';
import type { useXCrud } from '@/components/x-crud/useXCrud';
import type { FieldDescriptor } from '@/contracts/formSchema';

/**
 * XCrudGrid (JUM-772): sortable columns, pager or on-scroll pagination,
 * optional inline editing per cell, row click expands the detail card.
 */
const props = defineProps<{
  crud: ReturnType<typeof useXCrud>;
  canUpdate: (row: Record<string, unknown>) => boolean;
  canDelete: (row: Record<string, unknown>) => boolean;
}>();

const emit = defineEmits<{
  expand: [id: string, tab: 'preview' | 'edit'];
  delete: [id: string];
  inlineCommit: [id: string, field: string, value: unknown];
}>();

const editingCell = ref<{ id: string; field: string } | null>(null);
const editingValue = ref('');

const startInlineEdit = (id: string, d: FieldDescriptor, row: Record<string, unknown>): void => {
  if (!props.crud.config.inlineEdit || !isInlineEditable(d) || !props.canUpdate(row)) return;
  editingCell.value = { id, field: d.name };
  editingValue.value = String(row[d.name] ?? '');
};

const commitInlineEdit = (): void => {
  if (!editingCell.value) return;
  emit('inlineCommit', editingCell.value.id, editingCell.value.field, editingValue.value);
  editingCell.value = null;
};

const cancelInlineEdit = (): void => {
  editingCell.value = null;
};

const onScroll = (event: Event): void => {
  const target = event.target as HTMLElement;
  const nearBottom = target.scrollTop + target.clientHeight >= target.scrollHeight - 32;
  if (nearBottom) {
    props.crud.nextPage();
  }
};

const sortIndicator = (field: string): string => {
  if (props.crud.sort.value?.field !== field) return '';
  return props.crud.sort.value.direction === 'asc' ? '▲' : '▼';
};
</script>

<template>
  <div
    class="xcrud-grid"
    :class="{ 'xcrud-grid-scroll': crud.config.pagination === 'scroll' }"
    @scroll="crud.config.pagination === 'scroll' ? onScroll($event) : undefined"
  >
    <CTable responsive hover align="middle">
      <CTableHead>
        <CTableRow>
          <CTableHeaderCell
            v-for="d in crud.columns"
            :key="d.name"
            role="button"
            :aria-sort="crud.sort.value?.field === d.name ? crud.sort.value.direction : 'none'"
            @click="crud.toggleSort(d.name)"
          >
            {{ d.description ?? d.name }} <span class="text-body-secondary">{{ sortIndicator(d.name) }}</span>
          </CTableHeaderCell>
          <CTableHeaderCell class="text-end">Actions</CTableHeaderCell>
        </CTableRow>
      </CTableHead>
      <CTableBody>
        <template v-for="row in crud.visibleRows.value" :key="crud.rowId(row)">
          <CTableRow
            :active="crud.expandedId.value === crud.rowId(row)"
            @click="emit('expand', crud.rowId(row), 'preview')"
          >
            <CTableDataCell
              v-for="d in crud.columns"
              :key="d.name"
              @dblclick.stop="startInlineEdit(crud.rowId(row), d, row)"
            >
              <template v-if="editingCell?.id === crud.rowId(row) && editingCell?.field === d.name">
                <SearchableEnumInput
                  v-if="d.enum"
                  :id="`inline-${crud.rowId(row)}-${d.name}`"
                  :model-value="editingValue"
                  :options="d.enum"
                  :maxlength="d.maxLength"
                  @update:model-value="editingValue = $event"
                  @keyup.enter="commitInlineEdit"
                  @keyup.esc="cancelInlineEdit"
                />
                <CFormInput
                  v-else
                  :id="`inline-${crud.rowId(row)}-${d.name}`"
                  v-model="editingValue"
                  :maxlength="d.maxLength"
                  size="sm"
                  @keyup.enter="commitInlineEdit"
                  @keyup.esc="cancelInlineEdit"
                  @blur="commitInlineEdit"
                />
              </template>
              <template v-else>
                <span v-if="d.enum" class="badge text-bg-secondary">{{ formatCellValue(d, row[d.name]) }}</span>
                <span v-else>{{ formatCellValue(d, row[d.name]) }}</span>
              </template>
            </CTableDataCell>
            <CTableDataCell class="text-end" @click.stop>
              <XCrudRowMenu
                :can-update="canUpdate(row)"
                :can-delete="canDelete(row)"
                :extra-actions="crud.config.rowActions"
                @preview="emit('expand', crud.rowId(row), 'preview')"
                @edit="emit('expand', crud.rowId(row), 'edit')"
                @delete="emit('delete', crud.rowId(row))"
              />
            </CTableDataCell>
          </CTableRow>
          <CTableRow v-if="crud.expandedId.value === crud.rowId(row)" class="xcrud-detail-row">
            <CTableDataCell :colspan="crud.columns.length + 1">
              <slot name="detail" :row="row" />
            </CTableDataCell>
          </CTableRow>
        </template>
        <CTableRow v-if="!crud.loading.value && crud.visibleRows.value.length === 0">
          <CTableDataCell :colspan="crud.columns.length + 1" class="text-center text-body-secondary">
            Nenhum registro.
          </CTableDataCell>
        </CTableRow>
      </CTableBody>
    </CTable>

    <nav v-if="crud.config.pagination !== 'scroll'" aria-label="pagination" class="d-flex justify-content-center">
      <ul class="pagination pagination-sm">
        <li class="page-item" :class="{ disabled: crud.page.value <= 1 }">
          <button class="page-link" @click="crud.prevPage()">‹</button>
        </li>
        <li class="page-item disabled">
          <span class="page-link">{{ crud.page.value }} / {{ crud.pageCount.value }}</span>
        </li>
        <li class="page-item" :class="{ disabled: !crud.hasMore.value }">
          <button class="page-link" @click="crud.nextPage()">›</button>
        </li>
      </ul>
    </nav>
  </div>
</template>

<style scoped>
.xcrud-grid-scroll {
  max-height: 60vh;
  overflow-y: auto;
}
</style>
