import type { IUser } from '@src/modules/Users/domain/Entity/IUser';
import type { RequestCreatePhone } from '@src/modules/Users/interface/dto/RequestCreatePhone';
import type { IUserRepository } from '@src/modules/Users/service/ports/IUserRepository';

const createPhone = async (
  userId: string,
  payload: RequestCreatePhone,
  userDataRepository: IUserRepository
): Promise<IUser> => {
  const model = await userDataRepository.createPhone(userId, payload);
  return model.serialize();
};

export default createPhone;
