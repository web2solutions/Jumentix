import type { XCrudEntityConfig } from '@/components/x-crud/xCrudTypes';
import type { FieldDescriptor } from '@/contracts/formSchema';
import { rbacRoleNames } from '@/contracts/rbac';

/**
 * X-CRUD Users (JUM-772): full user management — list/create/update/delete,
 * roles from the OAS x-rbac matrix, organization as an OAS x-references FK.
 */
const primaryEmailField: FieldDescriptor = {
  name: 'primaryEmail',
  type: 'string',
  format: 'email',
  required: true,
  maxLength: 254,
  xLabel: { en: 'Primary e-mail', 'pt-BR': 'E-mail principal' }
};

export const usersCrudConfig: XCrudEntityConfig = {
  entity: 'User',
  title: { en: 'User', 'pt-BR': 'Usuário' },
  schemas: { create: 'RequestCreateUser', update: 'RequestUpdateUser' },
  operations: {
    list: 'getAll', create: 'create', update: 'update', delete: 'deleteOne'
  },
  searchFields: ['firstName', 'lastName', 'username'],
  pagination: 'pager',
  inlineEdit: true,
  avatarField: 'avatar',
  quickFilter: { field: 'organization', optionsOperationId: 'getAllOrganizations', allLabel: { en: 'All organizations', 'pt-BR': 'Todas as organizações' } },
  // Column labels come from the OAS `x-label` (JUM-780); no overrides needed here.
  aggregates: [
    { field: 'id', op: 'count', label: { en: 'Total users', 'pt-BR': 'Total de usuários' } },
    // count + groupBy = number of distinct groups; the chart shows the per-group split (JUM-781).
    {
      field: 'id', op: 'count', groupBy: 'organization', label: { en: 'Organizations represented', 'pt-BR': 'Organizações representadas' }
    }
  ],
  // roles is an array of strings; the checkbox options come from the OAS x-rbac matrix.
  arrayOptions: { roles: rbacRoleNames() },
  createFields: {
    // RequestCreateUser.emails (minItems 1) is satisfied by one primary email.
    exclude: ['emails'],
    extra: [primaryEmailField]
  },
  beforeSubmit: (body, mode) => {
    if (mode === 'create' && typeof body.primaryEmail === 'string' && body.primaryEmail) {
      const { primaryEmail, ...rest } = body;
      return {
        ...rest,
        emails: [{ email: primaryEmail, type: 'work', isPrimary: true }]
      };
    }
    return body;
  }
};
