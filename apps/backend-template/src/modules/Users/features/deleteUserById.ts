import type { IUserRepository } from '@src/modules/Users/service/ports/IUserRepository';

const deleteUserById = async (
  id: string,
  userDataRepository: IUserRepository
): Promise<boolean> => {
  await userDataRepository.delete(id);
  return true;
};

export default deleteUserById;
