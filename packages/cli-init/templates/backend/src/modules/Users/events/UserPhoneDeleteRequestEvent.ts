import { ComposeEventError } from '@src/infra/exceptions';
import BaseDomainEvent from '@src/modules/port/BaseDomainEvent';
import { canNotBeEmpty } from '@src/shared/validators';

import type { IEventMessage } from '@src/modules/port/IEventMessage';

class UserPhoneDeleteRequestEvent extends BaseDomainEvent {
  constructor(message: IEventMessage) {
    super(message);
    try {
      this.entity = 'User';
      this.action = 'deletePhone';
      canNotBeEmpty('message.authorization', message.authorization);
      canNotBeEmpty('message.params', message.params);
      // canNotBeEmpty('message.input', message.input);
    } catch (err) {
      throw new ComposeEventError((err as any).message);
    }
  }
}

export default UserPhoneDeleteRequestEvent;
