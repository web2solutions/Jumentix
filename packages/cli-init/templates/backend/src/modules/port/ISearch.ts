import type { IFilter } from './IFilter';

export interface ISearch {
  operator?: string;
  filters?: IFilter[];
}
