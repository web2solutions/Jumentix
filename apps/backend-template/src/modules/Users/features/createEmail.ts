import type { IUser } from '@src/modules/Users/domain/Entity/IUser';
import type { RequestCreateEmail } from '@src/modules/Users/interface/dto/RequestCreateEmail';
import type { IUserRepository } from '@src/modules/Users/service/ports/IUserRepository';

const createEmail = async (
  userId: string,
  payload: RequestCreateEmail,
  userDataRepository: IUserRepository
): Promise<IUser> => {
  const model = await userDataRepository.createEmail(userId, payload);
  return model.serialize();
};

export default createEmail;
