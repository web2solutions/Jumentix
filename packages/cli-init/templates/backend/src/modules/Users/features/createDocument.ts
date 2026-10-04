import type { IUser } from '@src/modules/Users/domain/Entity/IUser';
import type { RequestCreateDocument } from '@src/modules/Users/interface/dto/RequestCreateDocument';
import type { IUserRepository } from '@src/modules/Users/service/ports/IUserRepository';

const createDocument = async (
  userId: string,
  payload: RequestCreateDocument,
  userDataRepository: IUserRepository
): Promise<IUser> => {
  const model = await userDataRepository.createDocument(userId, payload);
  return model.serialize();
};

export default createDocument;
