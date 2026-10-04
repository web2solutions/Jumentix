import type { IUser } from '@src/modules/Users/domain/Entity/IUser';
import type { RequestUpdateDocument } from '@src/modules/Users/interface/dto/RequestUpdateDocument';
import type { IUserRepository } from '@src/modules/Users/service/ports/IUserRepository';

const updateDocument = async (
  userId: string,
  documentId: string,
  payload: RequestUpdateDocument,
  userDataRepository: IUserRepository
): Promise<IUser> => {
  const model = await userDataRepository.updateDocument(userId, documentId, payload);
  return model.serialize();
};

export default updateDocument;
