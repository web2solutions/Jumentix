import { ComposeEventError } from '@src/infra/exceptions';
import BaseDomainEvent from '@src/modules/port/BaseDomainEvent';
import { canNotBeEmpty } from '@src/shared/validators';

import type { IEventMessage } from '@src/modules/port/IEventMessage';

class UpdatePasswordRequestEvent<TPayload = any> extends BaseDomainEvent<TPayload> {
  constructor(message: IEventMessage<TPayload>) {
    super(message);
    try {
      this.entity = 'Auth';
      this.action = 'updatePassword';
      // canNotBeEmpty('message.authorization', message.authorization);
      canNotBeEmpty('message.input', message.input);
    } catch (err) {
      throw new ComposeEventError((err as any).message);
    }
  }
}

export default UpdatePasswordRequestEvent;
