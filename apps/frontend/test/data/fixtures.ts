/** Shared Cana fixtures for offline-layer unit tests (JUM-809). */
export const fixtureUsers = [
  {
    id: '1',
    firstName: 'Ana Lima',
    username: 'ana',
    organization: 'org-1',
    updatedAt: '2026-01-05T10:00:00.000Z'
  },
  {
    id: '2',
    firstName: 'bruno costa',
    username: 'bruno',
    organization: 'org-2',
    updatedAt: '2026-03-01T10:00:00.000Z'
  }
];

export const fixtureOrganizations = [
  { id: 'org-1', name: 'ACME', updatedAt: '2026-01-01T00:00:00.000Z' },
  { id: 'org-2', name: 'XpertMinds', updatedAt: '2026-01-02T00:00:00.000Z' }
];
