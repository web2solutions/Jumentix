import type { XCrudEntityConfig } from '@/components/x-crud/xCrudTypes';

/**
 * X-CRUD Organizations (JUM-772): organization management. Only superadmins
 * manage multiple organizations — the x-rbac matrix (OAS) grants create/delete
 * of organizations to superadmin only, and the kit hides those affordances.
 */
export const organizationsCrudConfig: XCrudEntityConfig = {
  entity: 'Organization',
  title: { en: 'Organization', 'pt-BR': 'Organização' },
  schemas: { create: 'RequestCreateOrganization', update: 'RequestUpdateOrganization' },
  operations: {
    list: 'getAllOrganizations',
    create: 'createOrganization',
    update: 'updateOrganization',
    delete: 'deleteOrganization'
  },
  searchFields: ['name'],
  pagination: 'pager',
  inlineEdit: true,
  // Column labels come from the OAS `x-label` (JUM-780); no overrides needed here.
  createFields: { exclude: ['users'] },
  aggregates: [
    { field: 'id', op: 'count', label: { en: 'Total organizations', 'pt-BR': 'Total de organizações' } },
    { field: 'users', op: 'sum', label: { en: 'Total members', 'pt-BR': 'Total de membros' } }
  ]
};
