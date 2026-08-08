import { BaseDomainEvent } from '@src/modules/port/BaseDomainEvent';
import type { IEventMessage } from '@src/modules/port/IEventMessage';
import { canNotBeEmpty } from '@src/shared/validators';
import { ComposeEventError } from '@src/infra/exceptions';

export class CatalogGetOneRequestEvent extends BaseDomainEvent {
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
