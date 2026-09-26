import { ComposeEventError } from '@src/infra/exceptions';
import BaseDomainEvent from '@src/modules/port/BaseDomainEvent';
import { canNotBeEmpty } from '@src/shared/validators';

import type { IEventMessage } from '@src/modules/port/IEventMessage';

class CatalogRestoreRequestEvent extends BaseDomainEvent {
  constructor(message: IEventMessage) {
    super(message);
    try {
      this.entity = 'Catalog';
      this.action = 'restore';
      canNotBeEmpty('message.authorization', message.authorization);
      canNotBeEmpty('message.params', message.params);
      canNotBeEmpty('message.input', message.input);
    } catch (err) {
      throw new ComposeEventError((err as any).message);
    }
  }
}

export default CatalogRestoreRequestEvent;
