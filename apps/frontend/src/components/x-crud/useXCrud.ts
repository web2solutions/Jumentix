import { computed, reactive, ref } from 'vue';

import { getSharedApiClient } from '@/contracts/apiClient';
import { fieldDescriptors, type FieldDescriptor } from '@/contracts/formSchema';
import { formatApiError } from '@/contracts/errors';
import { createEntityStore } from '@/stores/entityStore';
import { useAuthStore } from '@/stores/auth';

import type { XCrudAggregate, XCrudEntityConfig } from './xCrudTypes';

type Row = Record<string, unknown>;

export interface XCrudFilter {
  field: string;
  value: unknown;
}

/**
 * useXCrud — state and behavior of one X-CRUD instance (JUM-772): data via
 * the entity store (OAS operationIds), search, per-field filters, typed
 * column sorting, pager or on-scroll pagination, expanded row, aggregates.
 */
export const useXCrud = (config: XCrudEntityConfig) => {
  const store = createEntityStore(config)();

  const rowId = config.rowId ?? ((row: Row) => String(row.id));

  // Descriptors drive grid columns, filters and forms (requirement 136).
  const columns: FieldDescriptor[] = fieldDescriptors(config.entity)
    .filter((d) => d.name !== 'password');
  const createDescriptors = [
    ...fieldDescriptors(config.schemas.create)
      .filter((d) => d.name !== 'id' && !(config.createFields?.exclude ?? []).includes(d.name)),
    ...(config.createFields?.extra ?? [])
  ];
  const updateDescriptors = fieldDescriptors(config.schemas.update)
    .filter((d) => d.name !== 'id');

  const rows = ref<Row[]>([]);
  const loading = ref(false);
  const errorMessage = ref('');
  const notice = ref('');

  const search = ref('');
  const filters = reactive<Record<string, unknown>>({});
  const sort = ref<{ field: string; direction: 'asc' | 'desc' } | null>(null);
  const page = ref(1);
  const pageSizeRef = ref(config.pageSize ?? 10);
  const expandedId = ref<string | null>(null);
  // The id column is hidden by default (JUM-772): toggle it back in Columns.
  const hiddenColumns = reactive<string[]>(['id']);
  const selected = ref<Set<string>>(new Set());

  const visibleColumns = computed<FieldDescriptor[]>(() => (
    columns.filter((d) => !hiddenColumns.includes(d.name))
  ));

  const toggleColumn = (name: string): void => {
    const index = hiddenColumns.indexOf(name);
    if (index >= 0) hiddenColumns.splice(index, 1);
    else hiddenColumns.push(name);
  };

  const clearSelection = (): void => {
    selected.value = new Set();
  };

  const toggleSelect = (id: string): void => {
    const next = new Set(selected.value);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selected.value = next;
  };

  const load = async (): Promise<void> => {
    loading.value = true;
    errorMessage.value = '';
    try {
      rows.value = await store.list();
    } catch (error) {
      errorMessage.value = formatApiError(error);
    } finally {
      loading.value = false;
    }
  };

  /**
   * FK label resolution (x-references, JUM-772): referenced options load once
   * per field; grid/preview/charts show labels (org names), never raw uuids.
   */
  const referenceLabels = reactive<Record<string, Record<string, string>>>({});
  const referenceFields = columns.filter((d) => d.xReferences?.operationId);
  const loadReferences = async (): Promise<void> => {
    await Promise.all(referenceFields.map(async (d) => {
      const reference = d.xReferences!;
      try {
        const client = getSharedApiClient();
        const response = await client.request<{ result?: Array<Record<string, unknown>> }>({
          operationId: reference.operationId!,
          headers: { Authorization: useAuthStore().token }
        });
        const labelField = reference.labelField ?? 'name';
        referenceLabels[d.name] = Object.fromEntries(
          (response.result ?? []).map((row) => [String(row.id), String(row[labelField] ?? row.id)])
        );
      } catch {
        referenceLabels[d.name] = {};
      }
    }));
  };

  /** Label for a reference field value (falls back to the raw value). */
  const referenceLabel = (field: string, value: unknown): string => (
    referenceLabels[field]?.[String(value ?? '')] ?? String(value ?? '')
  );

  const matchesSearch = (row: Row, term: string): boolean => {
    if (!term) return true;
    const needle = term.toLowerCase();
    return config.searchFields.some((field) => String(row[field] ?? '').toLowerCase().includes(needle));
  };

  const matchesFilters = (row: Row): boolean => Object.entries(filters).every(([field, value]) => {
    if (value === undefined || value === null || value === '') return true;
    const cell = row[field];
    if (Array.isArray(value)) {
      // date range filter: [fromIso, toIso]
      const [from, to] = value as [string?, string?];
      const time = new Date(String(cell ?? '')).getTime();
      if (Number.isNaN(time)) return false;
      if (from && time < new Date(from).getTime()) return false;
      if (to && time > new Date(to).getTime()) return false;
      return true;
    }
    if (typeof value === 'boolean') return Boolean(cell) === value;
    return String(cell ?? '').toLowerCase().includes(String(value).toLowerCase());
  });

  const compareValues = (a: unknown, b: unknown): number => {
    if (typeof a === 'number' && typeof b === 'number') return a - b;
    if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b);
    const aTime = Date.parse(String(a ?? ''));
    const bTime = Date.parse(String(b ?? ''));
    if (!Number.isNaN(aTime) && !Number.isNaN(bTime) && String(a).length >= 8) return aTime - bTime;
    return String(a ?? '').localeCompare(String(b ?? ''));
  };

  const filteredRows = computed<Row[]>(() => {
    let result = rows.value
      .filter((row) => matchesSearch(row, search.value) && matchesFilters(row));
    if (sort.value) {
      const { field, direction } = sort.value;
      result = [...result].sort(
        (a, b) => compareValues(a[field], b[field]) * (direction === 'asc' ? 1 : -1)
      );
    }
    return result;
  });

  const pageCount = computed(() => (
    Math.max(1, Math.ceil(filteredRows.value.length / pageSizeRef.value))
  ));
  const visibleRows = computed<Row[]>(() => (
    config.pagination === 'scroll'
      ? filteredRows.value.slice(0, page.value * pageSizeRef.value)
      : filteredRows.value.slice(
        (page.value - 1) * pageSizeRef.value,
        page.value * pageSizeRef.value
      )
  ));
  const hasMore = computed(() => page.value < pageCount.value);

  const setPageSize = (size: number): void => {
    pageSizeRef.value = size;
    page.value = 1;
  };

  const allVisibleSelected = computed(() => (
    visibleRows.value.length > 0
    && visibleRows.value.every((row) => selected.value.has(rowId(row)))
  ));

  const toggleSelectAllVisible = (): void => {
    const next = new Set(selected.value);
    for (const row of visibleRows.value) {
      const id = rowId(row);
      if (allVisibleSelected.value) next.delete(id);
      else next.add(id);
    }
    selected.value = next;
  };

  const run = async (action: () => Promise<unknown>, success: string): Promise<void> => {
    errorMessage.value = '';
    notice.value = '';
    try {
      await action();
      notice.value = success;
      await load();
    } catch (error) {
      errorMessage.value = formatApiError(error);
    }
  };

  /** Bulk delete of the selected rows (JUM-772 redesign: X-SYNTH toolbar). */
  const submitBulkDelete = () => run(
    async () => {
      await Promise.all([...selected.value].map((id) => store.remove(id)));
    },
    `${config.title}: ${selected.value.size} registro(s) removido(s).`
  ).then(() => clearSelection());

  /** Exports the currently filtered rows as a JSON download (client-side). */
  const exportJson = (): void => {
    const payload = JSON.stringify(filteredRows.value, null, 2);
    const url = URL.createObjectURL(new Blob([payload], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${config.entity.toLowerCase()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const toggleSort = (field: string): void => {
    if (sort.value?.field !== field) {
      sort.value = { field, direction: 'asc' };
    } else if (sort.value.direction === 'asc') {
      sort.value = { field, direction: 'desc' };
    } else {
      sort.value = null;
    }
  };

  const setFilter = (field: string, value: unknown): void => {
    if (value === undefined || value === null || value === '') {
      delete filters[field];
    } else {
      filters[field] = value;
    }
    page.value = 1;
  };

  const toggleExpanded = (id: string): void => {
    expandedId.value = expandedId.value === id ? null : id;
  };

  const nextPage = (): void => {
    if (page.value < pageCount.value) page.value += 1;
  };

  const prevPage = (): void => {
    if (page.value > 1) page.value -= 1;
  };

  const goToPage = (target: number): void => {
    if (Number.isInteger(target) && target >= 1 && target <= pageCount.value) {
      page.value = target;
    }
  };

  const setSearch = (value: string): void => {
    search.value = value;
    page.value = 1;
  };

  const submitCreate = (body: Row) => run(
    () => store.create(config.beforeSubmit ? config.beforeSubmit(body, 'create') : body),
    `${config.title}: registro criado.`
  );

  const submitUpdate = (id: string, body: Row) => run(
    () => store.update(id, config.beforeSubmit ? config.beforeSubmit(body, 'update') : body),
    `${config.title}: registro atualizado.`
  );

  const submitDelete = (id: string) => run(() => store.remove(id), `${config.title}: registro removido.`);

  /** Inline cell commit: merges the edited scalar into the full row. */
  const submitInline = (id: string, field: string, value: unknown) => {
    const row = rows.value.find((entry) => rowId(entry) === id);
    if (!row) return Promise.resolve();
    return submitUpdate(id, { ...row, [field]: value });
  };

  const aggregateValue = (aggregate: XCrudAggregate): number => {
    const values = rows.value
      .map((row) => row[aggregate.field])
      .filter((value) => value !== undefined && value !== null);
    if (aggregate.op === 'count') {
      const { groupBy } = aggregate;
      return groupBy
        ? new Set(rows.value.map((row) => String(row[groupBy]))).size
        : rows.value.length;
    }
    const numbers = values
      .map((value) => (Array.isArray(value) ? value.length : Number(value)))
      .filter((n) => !Number.isNaN(n));
    if (numbers.length === 0) return 0;
    if (aggregate.op === 'sum') return numbers.reduce((a, b) => a + b, 0);
    if (aggregate.op === 'avg') return numbers.reduce((a, b) => a + b, 0) / numbers.length;
    if (aggregate.op === 'min') return Math.min(...numbers);
    return Math.max(...numbers);
  };

  const aggregateBreakdown = (
    aggregate: XCrudAggregate
  ): Array<{ label: string; value: number }> => {
    const { groupBy } = aggregate;
    if (!groupBy) return [];
    const buckets = new Map<string, number>();
    for (const row of rows.value) {
      const key = String(row[groupBy] ?? '—');
      const increment = aggregate.op === 'count' ? 1 : Number(row[aggregate.field] ?? 0) || 0;
      buckets.set(key, (buckets.get(key) ?? 0) + increment);
    }
    // Reference facets label with the referenced entity's name, not the uuid.
    return [...buckets.entries()].map(([label, value]) => ({
      label: referenceLabels[groupBy]?.[label] ?? label,
      value
    }));
  };

  return {
    config,
    columns,
    visibleColumns,
    hiddenColumns,
    selected,
    createDescriptors,
    updateDescriptors,
    rows,
    loading,
    errorMessage,
    notice,
    search,
    filters,
    sort,
    page,
    pageCount,
    pageSize: pageSizeRef,
    expandedId,
    filteredRows,
    visibleRows,
    hasMore,
    rowId,
    referenceLabels,
    referenceLabel,
    load,
    loadReferences,
    toggleSort,
    setFilter,
    toggleExpanded,
    nextPage,
    prevPage,
    setSearch,
    setPageSize,
    goToPage,
    toggleColumn,
    toggleSelect,
    toggleSelectAllVisible,
    allVisibleSelected,
    clearSelection,
    submitCreate,
    submitUpdate,
    submitDelete,
    submitBulkDelete,
    exportJson,
    submitInline,
    aggregateValue,
    aggregateBreakdown
  };
};

export type XCrud = ReturnType<typeof useXCrud>;
