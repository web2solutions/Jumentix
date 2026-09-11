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
  description: 'Primary e-mail'
};

export const usersCrudConfig: XCrudEntityConfig = {
  entity: 'User',
  title: 'User',
  schemas: { create: 'RequestCreateUser', update: 'RequestUpdateUser' },
  operations: {
    list: 'getAll', create: 'create', update: 'update', delete: 'deleteOne'
  },
  searchFields: ['firstName', 'lastName', 'username'],
  pagination: 'pager',
  inlineEdit: true,
  aggregates: [
    { field: 'id', op: 'count', label: 'Total users' },
    {
      field: 'id', op: 'count', groupBy: 'organization', label: 'Users per organization'
    }
  ],
  // roles is an array of strings; the checkbox options come from the OAS x-rbac matrix.
  arrayOptions: { roles: rbacRoleNames() },
  createFields: {
    // RequestCreateUser.emails (minItems 1) is satisfied by one primary email.
    exclude: ['emails', 'documents', 'phones'],
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
