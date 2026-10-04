import type { EDocumentType } from '@src/modules/ddd/valueObjects';

export interface RequestCreateDocument {
  data: string;
  type: EDocumentType;
  countryIssue: string;
}
