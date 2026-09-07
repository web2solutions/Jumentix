import { BaseDomainEvent } from '@src/modules/port/BaseDomainEvent';
import type { IEventMessage } from '@src/modules/port/IEventMessage';
import { canNotBeEmpty } from '@src/shared/validators';
import { ComposeEventError } from '@src/infra/exceptions';

export class CatalogDeleteRequestEvent extends BaseDomainEvent {
  constructor(message: IEventMessage) {
    super(message);
    try {
      this.entity = 'Catalog';
      this.action = 'delete';
      canNotBeEmpty('message.authorization', message.authorization);
      canNotBeEmpty('message.params', message.params);
      canNotBeEmpty('message.queryString', message.queryString);
    } catch (err) {
      throw new ComposeEventError((err as any).message);
    }
  }
}
