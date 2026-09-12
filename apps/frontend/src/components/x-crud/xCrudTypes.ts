/**
 * X-CRUD — generic, OAS-driven entity management kit (JUM-772).
 *
 * Generated Jumentix apps (payments, inventory, stock, sales, CRM, …) emit
 * one `XCrudEntityConfig` per entity; the kit renders list/create/update/
 * preview, search, per-field filters, sortable columns, pager or scroll
 * pagination, inline editing, row context menu, aggregates and RBAC-driven
 * affordances — nothing entity-specific is hardcoded in the kit.
 */
export type XCrudMode = 'create' | 'update' | 'preview';

export type XCrudPagination = 'pager' | 'scroll';

export interface XCrudAggregate {
  /** Field of the response schema the metric reads. */
  field: string;
  op: 'count' | 'sum' | 'avg' | 'min' | 'max';
  /** Optional enum facet to break the metric down by (bar chart). */
  groupBy?: string;
  label?: string;
}

export interface XCrudOperations {
  list: string;
  create: string;
  update: string;
  delete: string;
}

export interface XCrudEntityConfig {
  /** Response schema name in the OAS (drives grid columns/preview/filters). */
  entity: string;
  title: string;
  icon?: string;
  schemas: { create: string; update: string };
  operations: XCrudOperations;
  searchFields: string[];
  pagination?: XCrudPagination;
  pageSize?: number;
  /** Per-cell inline editing in the grid (scalars only). Default off. */
  inlineEdit?: boolean;
  aggregates?: XCrudAggregate[];
  /** array-of-string fields editable as checkbox groups (e.g. roles). */
  arrayOptions?: Record<string, string[]>;
  /** Create-form shaping: exclude OAS fields, append synthetic ones (e.g. primaryEmail). */
  createFields?: { exclude?: string[]; extra?: import('@/contracts/formSchema').FieldDescriptor[] };
  /** Body mapping before submit (e.g. primary email → emails[0]). */
  beforeSubmit?: (body: Record<string, unknown>, mode: 'create' | 'update') => Record<string, unknown>;
  /** Row identity (default: row.id). */
  rowId?: (row: Record<string, unknown>) => string;
  /** Extra row-menu actions injected by the consuming app. */
  rowActions?: Array<{ key: string; label: string; operationId?: string }>;
  /** Short column labels (override the OAS description in the grid header). */
  columnLabels?: Record<string, string>;
  /** Quick context filter in the toolbar (e.g. organization select). */
  quickFilter?: { field: string; optionsOperationId?: string; allLabel?: string };
  /** Export-visible-rows-as-JSON toolbar action (default true). */
  exportable?: boolean;
  /** Bulk delete via row selection (default true). */
  bulkDelete?: boolean;
  /** Field rendered as a round avatar in the grid/forms (e.g. avatar). */
  avatarField?: string;
}
