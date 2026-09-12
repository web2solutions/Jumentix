<script setup lang="ts">
import { ref } from 'vue';
import {
  CAvatar,
  CButton,
  CFormCheck,
  CFormInput,
  CFormSelect,
  CPlaceholder,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow
} from '@coreui/vue';

import SearchableEnumInput from '@/components/SearchableEnumInput.vue';
import XCrudColumnFilter from '@/components/x-crud/XCrudFilters.vue';
import XCrudRowMenu from '@/components/x-crud/XCrudRowMenu.vue';
import {
  badgeColorFor, formatCellValue, isInlineEditable, shortId
} from '@/components/x-crud/xCrudFormat';
import type { useXCrud } from '@/components/x-crud/useXCrud';
import type { FieldDescriptor } from '@/contracts/formSchema';

/**
 * XCrudGrid (JUM-772 redesign, X-SYNTH/Smart Table pattern): selection
 * column, uppercase sortable headers, per-column filter row, avatar cells,
 * colored badges, sticky actions with icon buttons, numbered pager footer.
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

const showFilters = ref(false);
const editingCell = ref<{ id: string; field: string } | null>(null);
const editingValue = ref('');

const columnLabel = (d: FieldDescriptor): string => (
  props.crud.config.columnLabels?.[d.name] ?? d.description ?? d.name
);

const isId = (d: FieldDescriptor): boolean => d.name === 'id' || d.format === 'uuid';

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

const onScroll = (event: Event): void => {
  const target = event.target as HTMLElement;
  if (target.scrollTop + target.clientHeight >= target.scrollHeight - 32) {
    props.crud.nextPage();
  }
};

const goTo = ref('1');
const goToPage = (): void => {
  props.crud.goToPage(Number(goTo.value));
};

const pageNumbers = (): number[] => {
  const count = props.crud.pageCount.value;
  const current = props.crud.page.value;
  const window = 5;
  const start = Math.max(1, Math.min(current - 2, count - window + 1));
  return Array.from({ length: Math.min(window, count) }, (_, index) => start + index);
};
</script>

<template>
  <div
    class="xcrud-grid"
    :class="{ 'xcrud-grid-scroll': crud.config.pagination === 'scroll' }"
    @scroll="crud.config.pagination === 'scroll' ? onScroll($event) : undefined"
  >
    <CTable responsive hover striped align="middle" class="mb-0">
      <CTableHead>
        <CTableRow>
          <CTableHeaderCell class="xcrud-select-col">
            <CFormCheck
              :model-value="crud.allVisibleSelected.value"
              aria-label="select all"
              @update:model-value="crud.toggleSelectAllVisible()"
            />
          </CTableHeaderCell>
          <CTableHeaderCell
            v-for="d in crud.visibleColumns.value"
            :key="d.name"
            role="button"
            class="small text-uppercase fw-semibold text-body-secondary xcrud-sortable"
            :aria-sort="crud.sort.value?.field === d.name ? crud.sort.value.direction : 'none'"
            @click="crud.toggleSort(d.name)"
          >
            {{ columnLabel(d) }}
            <CIcon
              v-if="crud.sort.value?.field === d.name"
              :icon="crud.sort.value.direction === 'asc' ? 'cil-arrow-top' : 'cil-arrow-bottom'"
              size="sm"
            />
            <CIcon v-else icon="cil-swap-vertical" size="sm" class="text-body-tertiary" />
          </CTableHeaderCell>
          <CTableHeaderCell class="text-end xcrud-actions-col">
            <CFormCheck
              :model-value="showFilters"
              aria-label="toggle column filters"
              title="Column filters"
              @update:model-value="showFilters = Boolean($event)"
            />
          </CTableHeaderCell>
        </CTableRow>
        <CTableRow v-if="showFilters" class="xcrud-filter-row">
          <CTableHeaderCell class="xcrud-select-col" />
          <CTableHeaderCell v-for="d in crud.visibleColumns.value" :key="d.name" class="fw-normal">
            <XCrudColumnFilter
              :descriptor="d"
              :value="crud.filters[d.name]"
              @set="crud.setFilter(d.name, $event)"
            />
          </CTableHeaderCell>
          <CTableHeaderCell />
        </CTableRow>
      </CTableHead>
      <CTableBody>
        <template v-if="crud.loading.value">
          <CTableRow v-for="index in 5" :key="index">
            <CTableDataCell :colspan="crud.visibleColumns.value.length + 2">
              <CPlaceholder component="span" animation="glow" class="d-block w-100">&nbsp;</CPlaceholder>
            </CTableDataCell>
          </CTableRow>
        </template>
        <template v-else>
        <template v-for="row in crud.visibleRows.value" :key="crud.rowId(row)">
          <CTableRow
            :active="crud.expandedId.value === crud.rowId(row)"
            @click="emit('expand', crud.rowId(row), 'preview')"
          >
            <CTableDataCell class="xcrud-select-col" @click.stop>
              <CFormCheck
                :model-value="crud.selected.value.has(crud.rowId(row))"
                :aria-label="`select ${crud.rowId(row)}`"
                @update:model-value="crud.toggleSelect(crud.rowId(row))"
              />
            </CTableDataCell>
            <CTableDataCell
              v-for="d in crud.visibleColumns.value"
              :key="d.name"
              @dblclick.stop="startInlineEdit(crud.rowId(row), d, row)"
            >
              <template v-if="editingCell?.id === crud.rowId(row) && editingCell?.field === d.name">
                <div class="d-flex gap-1 align-items-center">
                  <SearchableEnumInput
                    v-if="d.enum"
                    :id="`inline-${crud.rowId(row)}-${d.name}`"
                    :model-value="editingValue"
                    :options="d.enum"
                    :maxlength="d.maxLength"
                    @update:model-value="editingValue = $event"
                  />
                  <CFormInput
                    v-else
                    :id="`inline-${crud.rowId(row)}-${d.name}`"
                    v-model="editingValue"
                    :maxlength="d.maxLength"
                    size="sm"
                    @keyup.enter="commitInlineEdit"
                    @keyup.esc="editingCell = null"
                  />
                  <CButton color="success" variant="outline" size="sm" @click="commitInlineEdit">
                    <CIcon icon="cil-check" size="sm" />
                  </CButton>
                  <CButton color="secondary" variant="outline" size="sm" @click="editingCell = null">
                    <CIcon icon="cil-x" size="sm" />
                  </CButton>
                </div>
              </template>
              <template v-else-if="crud.config.avatarField === d.name">
                <CAvatar :src="String(row[d.name] ?? '')" size="sm" />
              </template>
              <template v-else-if="d.xReferences">
                {{ crud.referenceLabel(d.name, row[d.name]) }}
              </template>
              <template v-else-if="isId(d)">
                <span class="font-monospace small" :title="String(row[d.name] ?? '')">
                  {{ shortId(row[d.name]) }}
                </span>
              </template>
              <span
                v-else-if="d.enum"
                class="badge"
                :class="`text-bg-${badgeColorFor(row[d.name])}`"
              >{{ formatCellValue(d, row[d.name]) }}</span>
              <span v-else-if="d.type === 'array'" class="badge text-bg-light">
                {{ formatCellValue(d, row[d.name]) }}
              </span>
              <template v-else>{{ formatCellValue(d, row[d.name]) }}</template>
            </CTableDataCell>
            <CTableDataCell class="text-end xcrud-actions-col" @click.stop>
              <CButton
                color="primary"
                variant="outline"
                size="sm"
                class="me-1"
                :aria-label="`preview ${crud.rowId(row)}`"
                @click="emit('expand', crud.rowId(row), 'preview')"
              >
                <CIcon icon="cil-featured-playlist" size="sm" />
              </CButton>
              <CButton
                v-if="canUpdate(row)"
                color="primary"
                variant="outline"
                size="sm"
                class="me-1"
                :aria-label="`edit ${crud.rowId(row)}`"
                @click="emit('expand', crud.rowId(row), 'edit')"
              >
                <CIcon icon="cil-pencil" size="sm" />
              </CButton>
              <CButton
                v-if="canDelete(row)"
                color="danger"
                variant="outline"
                size="sm"
                :aria-label="`delete ${crud.rowId(row)}`"
                @click="emit('delete', crud.rowId(row))"
              >
                <CIcon icon="cil-trash" size="sm" />
              </CButton>
              <XCrudRowMenu
                v-if="(crud.config.rowActions ?? []).length"
                :can-update="false"
                :can-delete="false"
                :extra-actions="crud.config.rowActions"
              />
            </CTableDataCell>
          </CTableRow>
          <CTableRow v-if="crud.expandedId.value === crud.rowId(row)" class="xcrud-detail-row">
            <CTableDataCell :colspan="crud.visibleColumns.value.length + 2">
              <slot name="detail" :row="row" />
            </CTableDataCell>
          </CTableRow>
        </template>
        </template>
        <CTableRow v-if="!crud.loading.value && crud.visibleRows.value.length === 0">
          <CTableDataCell
            :colspan="crud.visibleColumns.value.length + 2"
            class="text-center text-body-secondary py-4"
          >
            <CIcon icon="cil-inbox" size="lg" class="d-block mx-auto mb-2" />
            No records found.
          </CTableDataCell>
        </CTableRow>
      </CTableBody>
    </CTable>

    <div class="d-flex flex-wrap align-items-center gap-2 px-3 py-2 border-top xcrud-footer">
      <span class="text-body-secondary small">
        {{ crud.filteredRows.value.length === 0
          ? '0 de 0'
          : `${(crud.page.value - 1) * crud.pageSize.value + 1}–${Math.min(crud.page.value * crud.pageSize.value, crud.filteredRows.value.length)} de ${crud.filteredRows.value.length}` }}
      </span>
      <label class="small text-body-secondary mb-0 d-flex align-items-center gap-1">
        Rows:
        <CFormSelect
          size="sm"
          class="w-auto"
          aria-label="rows per page"
          :model-value="String(crud.pageSize.value)"
          :options="['5', '10', '20', '50']"
          @update:model-value="crud.setPageSize(Number($event))"
        />
      </label>
      <nav class="ms-auto" aria-label="pagination">
        <ul class="pagination pagination-sm mb-0">
          <li class="page-item" :class="{ disabled: crud.page.value <= 1 }">
            <button class="page-link" aria-label="previous" @click="crud.prevPage()">‹</button>
          </li>
          <li
            v-for="number in pageNumbers()"
            :key="number"
            class="page-item"
            :class="{ active: number === crud.page.value }"
          >
            <button class="page-link" @click="crud.goToPage(number)">{{ number }}</button>
          </li>
          <li class="page-item" :class="{ disabled: !crud.hasMore.value }">
            <button class="page-link" aria-label="next" @click="crud.nextPage()">›</button>
          </li>
        </ul>
      </nav>
      <label class="small text-body-secondary mb-0 d-flex align-items-center gap-1">
        Go to:
        <CFormInput
          v-model="goTo"
          size="sm"
          class="xcrud-goto"
          aria-label="go to page"
          @keyup.enter="goToPage"
        />
      </label>
    </div>
  </div>
</template>

<style scoped>
.xcrud-grid-scroll {
  max-height: 60vh;
  overflow-y: auto;
}

.xcrud-select-col {
  width: 2.5rem;
}

.xcrud-actions-col {
  width: 9rem;
  white-space: nowrap;
}

.xcrud-sortable {
  cursor: pointer;
  user-select: none;
}

.xcrud-goto {
  width: 4rem;
}

/* X-SYNTH density: tighter rows and cells */
.xcrud-grid :deep(.table) {
  font-size: 0.875rem;
  margin-bottom: 0;
}

.xcrud-grid :deep(.table > :not(caption) > * > *) {
  padding: 0.35rem 0.6rem;
}

.xcrud-footer {
  row-gap: 0.25rem;
}
</style>
