// `export type`, not `export`: these are all type declarations (8 interfaces plus
// the `MessageHandler` type alias). A plain re-export has no runtime binding, so
// Bun's ESM runtime rejects the module with
// `SyntaxError: export 'IMessageResponse' not found in './contracts'` — 24 of the
// 30 load errors measured before this change came from this one statement.
export type {
  IEventBus,
  IIntegrationEvent,
  IMessage,
  IMessageHandlerRegistrationOptions,
  IMessageMediator,
  IMessageMetadata,
  IMessageRequestOptions,
  IMessageResponse,
  MessageHandler
} from './contracts';

export { default as InMemoryMessageMediatorAdapter } from './InMemoryMessageMediatorAdapter';
export { default as RabbitMqMessageMediatorAdapter } from './RabbitMqMessageMediatorAdapter';
export { default as BullMqMessageMediatorAdapter } from './BullMqMessageMediatorAdapter';
export { default as compileMessageMediator } from './compileMessageMediator';
