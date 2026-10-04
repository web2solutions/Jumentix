import { Context } from '@src/infra/context/Context';

import type { IDomainEventMetadata } from './IDomainEventMetadata';
import type { IEventMessage } from './IEventMessage';

abstract class BaseDomainEvent<TPayload = any> {
  public type: string = this.constructor.name;

  public authorization = '';

  public input: TPayload = {} as TPayload;

  public params: any = {};

  public queryString: any = {};

  public entity = '';

  public action = '';

  public message: any;

  public dateTime: Date = new Date();

  public schemaOAS: any = {};

  public readonly metadata: IDomainEventMetadata;

  constructor(message: IEventMessage) {
    const { input, authorization, entity, action, params, queryString, schemaOAS, metadata } =
      message;
    this.input = input || {};
    if (typeof input === 'string') {
      this.input = JSON.parse(input);
    }
    if (authorization) {
      this.authorization = authorization;
    }
    this.entity = entity ?? '';
    this.action = action ?? '';
    if (params) {
      this.params = params;
    }
    if (queryString) {
      this.queryString = queryString;
    }
    if (schemaOAS) {
      this.schemaOAS = schemaOAS;
    }
    const store: Map<any, any> = Context.getStore() as Map<any, any>;
    const correlationId = metadata?.correlationId ?? (store ? store.get('correlationId') : '');
    const timestamp = metadata?.timestamp ?? Date.now();
    const userId = metadata?.userId ?? (store ? store.get('userId') : '');
    const causationId = metadata?.causationId ?? (store ? store.get('correlationId') : '');

    this.metadata = {
      correlationId,
      causationId,
      timestamp,
      userId
    };
  }
}

export default BaseDomainEvent;
