import type BaseModel from './BaseModel';
import type BaseRepo from './BaseRepo';
// import { IStore } from './IStore';
import type { TRepos } from './TRepos';
import type { TServices } from './TServices';

export interface IServiceConfig {
  repos?: TRepos;
  services?: TServices;
  dataRepository: BaseRepo<BaseModel<Record<any, any>>, Record<any, any>, Record<any, any>>;
}
