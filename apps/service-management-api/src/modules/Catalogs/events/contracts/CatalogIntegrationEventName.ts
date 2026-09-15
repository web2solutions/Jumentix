export const CatalogIntegrationEventName = {
  Created: 'catalogs.catalog.created',
  Updated: 'catalogs.catalog.updated',
  Deleted: 'catalogs.catalog.deleted',
  Restored: 'catalogs.catalog.restored'
} as const;

export type CatalogIntegrationEventNameType = (
  typeof CatalogIntegrationEventName
)[keyof typeof CatalogIntegrationEventName];
