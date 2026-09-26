import type { IUser } from '@src/modules/Users/domain/Entity/IUser';
import type { RequestUpdateEmail } from '@src/modules/Users/interface/dto/RequestUpdateEmail';
import type { IUserRepository } from '@src/modules/Users/service/ports/IUserRepository';

const updateEmail = async (
  userId: string,
  documentId: string,
  payload: RequestUpdateEmail,
  userDataRepository: IUserRepository
): Promise<IUser> => {
  const model = await userDataRepository.updateEmail(userId, documentId, payload);
  return model.serialize();
};

export default updateEmail;
