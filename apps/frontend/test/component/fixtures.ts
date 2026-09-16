import type { Responder } from './support';

export const organizations = [
  {
    id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', name: 'ACME', address: [], phone: [], email: [], users: ['u1', 'u2'], createdAt: '2026-09-13T00:00:17.166Z', updatedAt: '2026-09-13T00:00:17.858Z'
  },
  {
    id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', name: 'Umbrella', address: [], phone: [], email: [], users: [], createdAt: '2026-09-12T10:00:00.000Z', updatedAt: '2026-09-12T10:00:00.000Z'
  }
];

export const users = [
  {
    id: 'u1',
    firstName: 'Zoe',
    lastName: 'Lima',
    username: 'zoe@x.dev',
    organization: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    roles: ['superadmin'],
    emails: [{
      id: 'e1', email: 'zoe@x.dev', type: 'work', isPrimary: true
    }],
    documents: [],
    phones: [{
      id: 'p1', countryCode: '+55', localCode: '11', number: '99999-0000', isPrimary: true
    }],
    createdAt: '2026-09-13T00:00:17.166Z',
    updatedAt: '2026-09-13T00:00:17.166Z'
  },
  {
    id: 'u2',
    firstName: 'Abraham',
    lastName: 'Costa',
    username: 'abe@x.dev',
    organization: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    roles: ['user'],
    emails: [{
      id: 'e2', email: 'abe@x.dev', type: 'work', isPrimary: true
    }],
    documents: [],
    phones: [],
    createdAt: '2026-09-12T00:00:00.000Z',
    updatedAt: '2026-09-12T00:00:00.000Z'
  },
  {
    id: 'u3',
    firstName: 'Mike',
    lastName: 'Silva',
    username: 'mike@x.dev',
    organization: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
    roles: ['admin'],
    emails: [{
      id: 'e3', email: 'mike@x.dev', type: 'work', isPrimary: true
    }],
    documents: [],
    phones: [],
    createdAt: '2026-09-11T00:00:00.000Z',
    updatedAt: '2026-09-11T00:00:00.000Z'
  }
];

/**
 * A stand-in for the JUM-777 backend: honours `q`, `sort`, `page`, `size`
 * for `/users` and `/organizations`, answers the profile `GET /users/u1`,
 * and echoes mutations. Filters are recorded by the harness, not applied.
 */
export const backend: Responder = (url, init) => {
  const path = url.pathname;
  if (init.method === 'GET' && /\/users\/u\d$/.test(path)) {
    const id = path.split('/').pop();
    return { body: users.find((user) => user.id === id) ?? users[0] };
  }
  let collection: Array<Record<string, unknown>> | null = null;
  if (path.endsWith('/organizations')) collection = organizations;
  else if (path.endsWith('/users')) collection = users;
  if (init.method === 'GET' && collection) {
    let rows = [...collection] as Array<Record<string, unknown>>;
    const q = url.searchParams.get('q');
    if (q) {
      const needle = q.toLowerCase();
      rows = rows.filter((row) => ['firstName', 'lastName', 'username', 'name']
        .some((field) => String(row[field] ?? '').toLowerCase().includes(needle)));
    }
    const sort = url.searchParams.get('sort');
    if (sort) {
      const [field, direction] = sort.split(':');
      rows.sort((a, b) => String(a[field]).localeCompare(String(b[field])) * (direction === 'desc' ? -1 : 1));
    }
    const page = Number(url.searchParams.get('page') ?? 1);
    const size = Number(url.searchParams.get('size') ?? 30);
    const totalPages = Math.max(1, Math.ceil(rows.length / size));
    if (page > totalPages) {
      return { status: 400, body: { message: 'page number must be smaller than the number of total pages' } };
    }
    return {
      body: {
        result: rows.slice((page - 1) * size, page * size), page, size, total: rows.length
      }
    };
  }
  if (init.method === 'POST' && path.endsWith('/auth/login')) {
    // JWT-shaped token whose payload carries id + username (decoded client-side).
    const payload = Buffer.from(JSON.stringify({ id: 'u1', username: 'zoe@x.dev' })).toString('base64url');
    return { body: { Authorization: `Bearer x.${payload}.y` } };
  }
  return { body: init.body ? JSON.parse(init.body) : {} };
};
