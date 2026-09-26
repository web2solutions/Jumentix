import { ComposeEventError } from '@src/infra/exceptions';
import BaseDomainEvent from '@src/modules/port/BaseDomainEvent';
import { canNotBeEmpty } from '@src/shared/validators';

import type { IEventMessage } from '@src/modules/port/IEventMessage';

class CatalogGetOneRequestEvent extends BaseDomainEvent {
  constructor(message: IEventMessage) {
    super(message);
    this.entity = 'Catalog';
    this.action = 'getOneById';
    try {
      canNotBeEmpty('message.authorization', message.authorization);
      canNotBeEmpty('message.params', message.params);
    } catch (err) {
      throw new ComposeEventError((err as any).message);
    }
  }
}

export default CatalogGetOneRequestEvent;
