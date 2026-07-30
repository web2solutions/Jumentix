import type { IServiceResponse } from '@src/modules/port/IServiceResponse';
import type { IAuthorizationHeader } from '@src/modules/Users/service/ports/IAuthorizationHeader';
import type { ILoginRequest } from '@src/modules/Users/interface/dto/ILoginRequest';
import type { IRegisterRequest } from '@src/modules/Users/interface/dto/IRegisterRequest';
import type { IUpdatePasswordRequest } from '@src/modules/Users/interface/dto/IUpdatePasswordRequest';
import type { ILogoutRequest } from '@src/modules/Users/interface/dto/ILogoutRequest';

export interface IAuthUseCases {
  login(data: ILoginRequest): Promise<IServiceResponse<IAuthorizationHeader>>;
  register(data: IRegisterRequest): Promise<IServiceResponse<Record<string, any>>>;
  updatePassword(
    authorization: string,
    data: IUpdatePasswordRequest
  ): Promise<IServiceResponse<boolean>>;
  logout(
    authorization: string,
    data: ILogoutRequest
  ): Promise<IServiceResponse<boolean>>;
}
