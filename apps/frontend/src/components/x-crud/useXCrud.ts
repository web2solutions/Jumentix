import { computed, reactive, ref } from 'vue';

import { fieldDescriptors, type FieldDescriptor } from '@/contracts/formSchema';
import { formatApiError } from '@/contracts/errors';
import { createEntityStore } from '@/stores/entityStore';

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
  const expandedId = ref<string | null>(null);

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
      result = [...result].sort((a, b) => compareValues(a[field], b[field]) * (direction === 'asc' ? 1 : -1));
    }
    return result;
  });

  const pageSize = config.pageSize ?? 10;
  const pageCount = computed(() => Math.max(1, Math.ceil(filteredRows.value.length / pageSize)));
  const visibleRows = computed<Row[]>(() => (
    config.pagination === 'scroll'
      ? filteredRows.value.slice(0, page.value * pageSize)
      : filteredRows.value.slice((page.value - 1) * pageSize, page.value * pageSize)
  ));
  const hasMore = computed(() => page.value < pageCount.value);

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

  const setSearch = (value: string): void => {
    search.value = value;
    page.value = 1;
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
    if (!aggregate.groupBy) return [];
    const buckets = new Map<string, number>();
    for (const row of rows.value) {
      const key = String(row[aggregate.groupBy] ?? '—');
      const increment = aggregate.op === 'count' ? 1 : Number(row[aggregate.field] ?? 0) || 0;
      buckets.set(key, (buckets.get(key) ?? 0) + increment);
    }
    return [...buckets.entries()].map(([label, value]) => ({ label, value }));
  };

  return {
    config,
    columns,
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
    pageSize,
    expandedId,
    filteredRows,
    visibleRows,
    hasMore,
    rowId,
    load,
    toggleSort,
    setFilter,
    toggleExpanded,
    nextPage,
    prevPage,
    setSearch,
    submitCreate,
    submitUpdate,
    submitDelete,
    submitInline,
    aggregateValue,
    aggregateBreakdown
  };
};

export type XCrud = ReturnType<typeof useXCrud>;
