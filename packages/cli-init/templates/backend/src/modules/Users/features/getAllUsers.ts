import type { IPagingRequest, IPagingResponse } from '@src/modules/port';
import type { IUser } from '@src/modules/Users/domain/Entity/IUser';
import type User from '@src/modules/Users/domain/Model/User';
import type { IUserRepository } from '@src/modules/Users/service/ports/IUserRepository';

const getAllUsers = async (
  filters: Record<string, string | number>,
  paging: IPagingRequest,
  userDataRepository: IUserRepository
): Promise<IPagingResponse<IUser[]>> => {
  const response = await userDataRepository.getAll({ ...filters }, paging);
  const rawDocs: IUser[] = response.result.map((model: User) => model.serialize());
  return {
    ...response,
    result: rawDocs
  };
};

export default getAllUsers;
