import type { IUser } from '@src/modules/Users/domain/Entity/IUser';
import type { IUserRepository } from '@src/modules/Users/service/ports/IUserRepository';

const deleteEmail = async (
  userId: string,
  emailId: string,
  userDataRepository: IUserRepository
): Promise<IUser> => {
  const model = await userDataRepository.deleteEmail(userId, emailId);
  return model.serialize();
};

export default deleteEmail;
