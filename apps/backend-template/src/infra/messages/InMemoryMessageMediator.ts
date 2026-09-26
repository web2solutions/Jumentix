import InMemoryMessageMediatorAdapter from '@src/infra/messages/adapters/InMemoryMessageMediatorAdapter';

// Backward-compatible export name while keeping adapter semantics explicit.
class InMemoryMessageMediator extends InMemoryMessageMediatorAdapter {}

export default InMemoryMessageMediator;
