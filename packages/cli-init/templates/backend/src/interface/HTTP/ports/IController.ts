import type { IDatabaseClient } from '@src/infra/persistence/port/IDatabaseClient';
import type { IServiceResponse } from '@src/modules/port';
import type BaseDomainEvent from '@src/modules/port/BaseDomainEvent';
import type { IAuthService } from '@src/modules/Users/service/ports/IAuthService';

export interface IController {
  authService: IAuthService;
  openApiSpecification: any;
  databaseClient: IDatabaseClient;
  create?(event: BaseDomainEvent): Promise<IServiceResponse>;
  update?(event: BaseDomainEvent): Promise<IServiceResponse>;
  delete?(event: BaseDomainEvent): Promise<IServiceResponse>;
  getOneById?(event: BaseDomainEvent): Promise<IServiceResponse>;
  getAll?(event: BaseDomainEvent): Promise<IServiceResponse>;
  getUsersMetrics?(event: BaseDomainEvent): Promise<IServiceResponse>;
  getOrganizationsMetrics?(event: BaseDomainEvent): Promise<IServiceResponse>;
  login?(event: BaseDomainEvent): Promise<IServiceResponse>;
  logout?(event: BaseDomainEvent): Promise<IServiceResponse>;
  register?(event: BaseDomainEvent): Promise<IServiceResponse>;
  updatePassword?(event: BaseDomainEvent): Promise<IServiceResponse>;
  createOrganization?(event: BaseDomainEvent): Promise<IServiceResponse>;
  updateOrganization?(event: BaseDomainEvent): Promise<IServiceResponse>;
  deleteOrganization?(event: BaseDomainEvent): Promise<IServiceResponse>;
  getOrganizationById?(event: BaseDomainEvent): Promise<IServiceResponse>;
  getAllOrganizations?(event: BaseDomainEvent): Promise<IServiceResponse>;
  createOrganizationAddress?(event: BaseDomainEvent): Promise<IServiceResponse>;
  updateOrganizationAddress?(event: BaseDomainEvent): Promise<IServiceResponse>;
  deleteOrganizationAddress?(event: BaseDomainEvent): Promise<IServiceResponse>;
  createOrganizationPhone?(event: BaseDomainEvent): Promise<IServiceResponse>;
  updateOrganizationPhone?(event: BaseDomainEvent): Promise<IServiceResponse>;
  deleteOrganizationPhone?(event: BaseDomainEvent): Promise<IServiceResponse>;
  createOrganizationEmail?(event: BaseDomainEvent): Promise<IServiceResponse>;
  updateOrganizationEmail?(event: BaseDomainEvent): Promise<IServiceResponse>;
  deleteOrganizationEmail?(event: BaseDomainEvent): Promise<IServiceResponse>;
  restore?(event: BaseDomainEvent): Promise<IServiceResponse>;
  // update(event: BaseDomainEvent): Promise<IServiceResponse<any>>;
  // create(event: BaseDomainEvent): Promise<IServiceResponse<any>>;
  // create(event: BaseDomainEvent): Promise<IServiceResponse<any>>;
}
