export interface RequestCreateCatalog {
  name: string;
  description?: string;
  organization?: string;
  design: Record<string, any>;
  provenance?: Record<string, any>;
}
