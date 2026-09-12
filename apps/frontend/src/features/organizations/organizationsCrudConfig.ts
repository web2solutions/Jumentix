import type { XCrudEntityConfig } from '@/components/x-crud/xCrudTypes';

/**
 * X-CRUD Organizations (JUM-772): organization management. Only superadmins
 * manage multiple organizations — the x-rbac matrix (OAS) grants create/delete
 * of organizations to superadmin only, and the kit hides those affordances.
 */
export const organizationsCrudConfig: XCrudEntityConfig = {
  entity: 'Organization',
  title: 'Organization',
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
  columnLabels: {
    id: 'ID',
    name: 'Name',
    address: 'Addresses',
    phone: 'Phones',
    email: 'Emails',
    users: 'Members',
    createdAt: 'Created',
    updatedAt: 'Updated'
  },
  createFields: { exclude: ['users'] },
  aggregates: [
    { field: 'id', op: 'count', label: 'Total organizations' },
    { field: 'users', op: 'sum', label: 'Total members' }
  ]
};
