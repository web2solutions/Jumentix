import { ComposeEventError } from '@src/infra/exceptions';
import BaseDomainEvent from '@src/modules/port/BaseDomainEvent';
import { canNotBeEmpty } from '@src/shared/validators';

import type { IEventMessage } from '@src/modules/port/IEventMessage';

class UserPhoneUpdateRequestEvent extends BaseDomainEvent {
  constructor(message: IEventMessage) {
    super(message);
    try {
      this.entity = 'User';
      this.action = 'updatePhone';
      canNotBeEmpty('message.authorization', message.authorization);
      canNotBeEmpty('message.input', message.input);
      canNotBeEmpty('message.params', message.params);
    } catch (err) {
      throw new ComposeEventError((err as any).message);
    }
  }
}

export default UserPhoneUpdateRequestEvent;
