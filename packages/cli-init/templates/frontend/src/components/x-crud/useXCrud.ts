import {
  computed, getCurrentInstance, onMounted, onUnmounted, reactive, ref
} from 'vue';

import { getSharedApiClient } from '@/contracts/apiClient';
import { apiErrorStatus, formatApiError } from '@/contracts/errors';
import {
  entityPrimaryKey,
  fieldDescriptors,
  listOperationForEntity,
  type FieldDescriptor
} from '@/contracts/formSchema';
import { listCapabilities, type ListCapabilities, type ListQuery } from '@/contracts/listSchema';
import { isCanaOpen } from '@/data/db';
import { listLocal, subscribeLocal } from '@/data/localRepository';
import { localized, t } from '@/i18n';
import { createEntityStore } from '@/stores/entityStore';
import { useAuthStore } from '@/stores/auth';

import type { XCrudAggregate, XCrudEntityConfig } from './xCrudTypes';

type Row = Record<string, unknown>;

export interface XCrudFilter {
  field: string;
  value: unknown;
}

/**
 * useXCrud — state and behavior of one X-CRUD instance (JUM-772, JUM-778).
 *
 * Two data modes, chosen by the contract:
 * - **server**: the list operation declares `x-list-capabilities`; every
 *   search/filter/sort/page change becomes one request with the wire query
 *   and `rows` holds exactly the current page (`total` from the envelope);
 * - **memory**: no capabilities; the whole list is loaded once and the same
 *   controls run in memory (operations that predate JUM-777).
 * Nothing in component config picks the mode; a generated app gets the right
 * behaviour from its spec.
 */
export const useXCrud = (config: XCrudEntityConfig) => {
  const store = createEntityStore(config)();
  const capabilities: ListCapabilities | undefined = listCapabilities(config.operations.list);
  const serverMode = capabilities !== undefined;

  const rowId = config.rowId ?? ((row: Row) => {
    const key = entityPrimaryKey(config.entity);
    return String(row[key] ?? row.id ?? row._id ?? '');
  });

  /** Entity display name in the active locale. */
  const title = computed(() => localized(config.title));

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
  const serverTotal = ref(0);
  const loading = ref(false);
  const errorMessage = ref('');
  const notice = ref('');

  const search = ref('');
  const filters = reactive<Record<string, unknown>>({});
  const sort = ref<{ field: string; direction: 'asc' | 'desc' } | null>(null);
  const page = ref(1);
  const pageSizeRef = ref(config.pageSize ?? capabilities?.defaultSize ?? 10);
  const expandedId = ref<string | null>(null);
  // The id column is hidden by default (JUM-772): toggle it back in Columns.
  const hiddenColumns = reactive<string[]>(['id']);
  const selected = ref<Set<string>>(new Set());

  /** Affordances the contract allows (server mode) or everything (memory mode). */
  const canSort = (field: string): boolean => !serverMode || capabilities!.sortable.includes(field);
  const canFilter = (field: string): boolean => !serverMode || field in capabilities!.filterable;
  const canSearch = computed(() => !serverMode || capabilities!.searchable.length > 0);

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

  /**
   * Wire filter for one column value (server mode): text → contains, date
   * range → between, arrays → in, everything else → equality. Fields the
   * contract does not declare filterable are dropped, not sent.
   */
  const wireFilter = (field: string, value: unknown): unknown => {
    if (Array.isArray(value)) {
      const [from, to] = value as [string?, string?];
      if (!from && !to) return undefined;
      return { operator: 'between', value: [from || '', to ? `${to}T23:59:59.999Z` : ''] };
    }
    if (capabilities?.filterable[field] === 'text') {
      return { operator: 'contains', value: String(value) };
    }
    return value;
  };

  const wireFilters = (): Record<string, unknown> => {
    const out: Record<string, unknown> = {};
    Object.entries(filters).forEach(([field, value]) => {
      if (value === undefined || value === null || value === '' || !canFilter(field)) return;
      const wired = wireFilter(field, value);
      if (wired !== undefined) out[field] = wired;
    });
    return out;
  };

  const serverQuery = (): ListQuery => ({
    page: page.value,
    size: pageSizeRef.value,
    sort: sort.value && canSort(sort.value.field)
      ? `${sort.value.field}:${sort.value.direction}`
      : undefined,
    q: canSearch.value && search.value.trim() ? search.value.trim() : undefined,
    filter: wireFilters()
  });

  /** Scroll mode accumulates pages; pager mode replaces them. */
  const scrollBuffer = ref<Row[]>([]);

  const load = async (): Promise<void> => {
    loading.value = true;
    errorMessage.value = '';
    try {
      if (!serverMode) {
        const all = await store.list();
        rows.value = all.result;
        serverTotal.value = all.total;
        return;
      }
      const result = await store.list(serverQuery());
      serverTotal.value = result.total;
      if (config.pagination === 'scroll') {
        scrollBuffer.value = page.value === 1
          ? result.result
          : [...scrollBuffer.value, ...result.result];
        rows.value = scrollBuffer.value;
      } else {
        rows.value = result.result;
      }
    } catch (error) {
      // A stale total after a delete asks for a page past the last one; the
      // contract answers 400. Step back to the last existing page once.
      if (serverMode && apiErrorStatus(error) === 400 && page.value > 1) {
        page.value -= 1;
        notice.value = t('error.pageOutOfRange');
        loading.value = false;
        await load();
        return;
      }
      errorMessage.value = formatApiError(error);
    } finally {
      loading.value = false;
    }
  };

  /** Server-mode trigger: reset to page 1 and reload; memory mode just resets the page. */
  const requery = (): Promise<void> => {
    page.value = 1;
    return serverMode ? load() : Promise.resolve();
  };

  /**
   * Typed input (search, text filters) waits `debounceMs` before hitting the
   * server so a word is one request, not one per keystroke (JUM-781). Sort,
   * paging and select filters requery immediately.
   */
  const debounceMs = config.debounceMs ?? 250;
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  const requeryDebounced = (): void => {
    page.value = 1;
    if (!serverMode) return;
    if (debounceTimer) clearTimeout(debounceTimer);
    if (debounceMs <= 0) {
      load().catch(() => undefined);
      return;
    }
    debounceTimer = setTimeout(() => {
      debounceTimer = undefined;
      load().catch(() => undefined);
    }, debounceMs);
  };

  /**
   * FK label resolution (`x-relation`, JUM-787): list candidates come from the
   * target entity's `<Entity>ArrayOf` operation, never from a hardcoded op id.
   */
  const referenceLabels = reactive<Record<string, Record<string, string>>>({});
  const referenceFields = columns.filter((d) => d.relation?.entity);
  const loadReferences = async (): Promise<void> => {
    await Promise.all(referenceFields.map(async (d) => {
      const relation = d.relation!;
      const operationId = listOperationForEntity(relation.entity);
      if (!operationId) {
        referenceLabels[d.name] = {};
        return;
      }
      try {
        const targetCapabilities = listCapabilities(operationId);
        type Rows = Array<Record<string, unknown>>;
        type ReferenceRows = { result?: Rows } | Rows;
        let list: Rows = [];
        if (isCanaOpen()) {
          const localPage = await listLocal(relation.entity, {
            page: 1,
            size: targetCapabilities?.maxSize ?? 100
          });
          list = localPage.result;
        } else {
          const client = getSharedApiClient();
          const response = await client.request<ReferenceRows>({
            operationId,
            query: targetCapabilities ? { page: 1, size: targetCapabilities.maxSize } : undefined,
            headers: { Authorization: useAuthStore().token }
          });
          list = Array.isArray(response) ? response : (response.result ?? []);
        }
        const labelField = relation.display ?? 'name';
        const match = relation.match || entityPrimaryKey(relation.entity);
        referenceLabels[d.name] = Object.fromEntries(
          list.map((row) => [String(row[match] ?? row.id), String(row[labelField] ?? row[match] ?? '')])
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

  // ---- memory mode: the same controls over the loaded list ----------------

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
      if (to && time > new Date(`${to}T23:59:59.999Z`).getTime()) return false;
      return true;
    }
    if (typeof value === 'boolean') return Boolean(cell) === value;
    if (Array.isArray(cell)) return cell.some((entry) => String(entry) === String(value));
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

  /** Memory mode: filtered+sorted list. Server mode: the page as delivered. */
  const filteredRows = computed<Row[]>(() => {
    if (serverMode) return rows.value;
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

  /** Records matching the current query across all pages. */
  const total = computed(() => (serverMode ? serverTotal.value : filteredRows.value.length));

  const pageCount = computed(() => (
    Math.max(1, Math.ceil(total.value / pageSizeRef.value))
  ));

  const visibleRows = computed<Row[]>(() => {
    if (serverMode) return rows.value;
    return config.pagination === 'scroll'
      ? filteredRows.value.slice(0, page.value * pageSizeRef.value)
      : filteredRows.value.slice(
        (page.value - 1) * pageSizeRef.value,
        page.value * pageSizeRef.value
      );
  });
  const hasMore = computed(() => page.value < pageCount.value);

  const setPageSize = (size: number): void => {
    const bounded = capabilities
      ? Math.min(Math.max(1, size), capabilities.maxSize)
      : Math.max(1, size);
    pageSizeRef.value = bounded;
    requery().catch(() => undefined);
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
      if (serverMode && config.pagination === 'scroll') page.value = 1;
      await load();
    } catch (error) {
      errorMessage.value = formatApiError(error);
    }
  };

  /** Bulk delete of the selected rows (JUM-772 redesign: X-SYNTH toolbar). */
  const submitBulkDelete = () => {
    const count = selected.value.size;
    return run(
      async () => {
        await Promise.all([...selected.value].map((id) => store.remove(id)));
      },
      t('crud.bulkRemoved', { entity: title.value, count })
    ).then(() => clearSelection());
  };

  /** Exports the currently visible rows as a JSON download (client-side). */
  const exportJson = (): void => {
    const payload = JSON.stringify(serverMode ? rows.value : filteredRows.value, null, 2);
    const url = URL.createObjectURL(new Blob([payload], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${config.entity.toLowerCase()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const toggleSort = (field: string): void => {
    if (!canSort(field)) return;
    if (sort.value?.field !== field) {
      sort.value = { field, direction: 'asc' };
    } else if (sort.value.direction === 'asc') {
      sort.value = { field, direction: 'desc' };
    } else {
      sort.value = null;
    }
    requery().catch(() => undefined);
  };

  const setFilter = (field: string, value: unknown): void => {
    const empty = value === undefined || value === null || value === ''
      || (Array.isArray(value) && value.every((entry) => !entry));
    if (empty) {
      delete filters[field];
    } else {
      filters[field] = value;
    }
    const typed = typeof value === 'string' && capabilities?.filterable[field] === 'text';
    if (typed) requeryDebounced();
    else requery().catch(() => undefined);
  };

  const toggleExpanded = (id: string): void => {
    expandedId.value = expandedId.value === id ? null : id;
  };

  const nextPage = (): void => {
    if (page.value < pageCount.value) {
      page.value += 1;
      if (serverMode) load().catch(() => undefined);
    }
  };

  const prevPage = (): void => {
    if (page.value > 1) {
      page.value -= 1;
      if (serverMode) load().catch(() => undefined);
    }
  };

  const goToPage = (target: number): void => {
    const inRange = Number.isInteger(target) && target >= 1 && target <= pageCount.value;
    if (inRange && target !== page.value) {
      page.value = target;
      if (serverMode) load().catch(() => undefined);
    }
  };

  const setSearch = (value: string): void => {
    search.value = value;
    requeryDebounced();
  };

  const submitCreate = (body: Row) => run(
    () => store.create(config.beforeSubmit ? config.beforeSubmit(body, 'create') : body),
    t('crud.created', { entity: title.value })
  );

  const submitUpdate = (id: string, body: Row) => run(
    () => store.update(id, config.beforeSubmit ? config.beforeSubmit(body, 'update') : body),
    t('crud.updated', { entity: title.value })
  );

  const submitDelete = (id: string) => run(
    () => store.remove(id),
    t('crud.removed', { entity: title.value })
  );

  /** Inline cell commit: merges the edited scalar into the full row. */
  const submitInline = (id: string, field: string, value: unknown) => {
    const row = rows.value.find((entry) => rowId(entry) === id);
    if (!row) return Promise.resolve();
    return submitUpdate(id, { ...row, [field]: value });
  };

  /**
   * Aggregates read the loaded rows. In server mode that is the current page
   * (the widget says so), except `count` without `groupBy`, which is the
   * server `total` — the one number the envelope makes exact.
   */
  const aggregateScope = computed<'all' | 'page'>(() => (
    serverMode && !isCanaOpen() ? 'page' : 'all'
  ));

  const aggregateValue = (aggregate: XCrudAggregate): number => {
    if (aggregate.op === 'count' && !aggregate.groupBy) {
      return serverMode && !isCanaOpen() ? serverTotal.value : rows.value.length;
    }
    const values = rows.value
      .map((row) => row[aggregate.field])
      .filter((value) => value !== undefined && value !== null);
    if (aggregate.op === 'count') {
      const { groupBy } = aggregate;
      return new Set(rows.value.map((row) => String(row[groupBy!]))).size;
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

  /** True when the widget's number covers only the loaded page. */
  const aggregateIsPartial = (aggregate: XCrudAggregate): boolean => (
    serverMode
    && !isCanaOpen()
    && !(aggregate.op === 'count' && !aggregate.groupBy)
    && serverTotal.value > rows.value.length
  );

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

  if (getCurrentInstance()) {
    onMounted(() => {
      if (!isCanaOpen()) return undefined;
      const stop = subscribeLocal(config.entity, () => {
        load().catch(() => undefined);
      });
      onUnmounted(stop);
      return undefined;
    });
  }

  return {
    config,
    title,
    capabilities,
    serverMode,
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
    total,
    expandedId,
    filteredRows,
    visibleRows,
    hasMore,
    rowId,
    referenceLabels,
    referenceLabel,
    canSort,
    canFilter,
    canSearch,
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
    aggregateScope,
    aggregateValue,
    aggregateIsPartial,
    aggregateBreakdown
  };
};

export type XCrud = ReturnType<typeof useXCrud>;
