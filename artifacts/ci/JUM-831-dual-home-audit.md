# JUM-831 dual-home audit (infra + sdk)

| Suite | Decision | Rationale |
| --- | --- | --- |
| infra/persistence/KeyValueStorage/BaseKeyValueStorageClient.test.ts | deleted | Pure `@jumentix/key-value-storage` re-export; covered by `packages/key-value-storage/test/key-value-storage.test.ts` |
| infra/persistence/KeyValueStorage/InMemoryKeyValueStorageClient.test.ts | deleted | Same package coverage |
| infra/mutex/MutexService.test.ts | deleted | Facade re-exports `@jumentix/mutex-service`; covered by `packages/mutex-service/test/MutexService.test.ts` |
| infra/mutex/MutexService.branches.test.ts | deleted | Package MutexService branches already asserted in package suite |
| sdk-clients/grpc/GrpcApiClient.test.ts | deleted | Covered by `packages/sdk-grpc-client/test/GrpcApiClient.test.ts` |
| infra/persistence/external/ExternalStoreProxy.test.ts | stays | Wires template `BaseExternalDataRepository` + `@src/infra/exceptions` composition |
| infra/persistence/external/ExternalRepositories.test.ts | stays | Template external repository constructors |
| infra/messages/compileMessageMediator.test.ts | stays | Compiles template adapter classes (InMemory/Rabbit/Bull facades) |
| infra/messages/InMemoryMessageMediator.test.ts | stays | Template adapter subclass |
| infra/messages/MessageMediator.taskCreateFlow.test.ts | stays | Wires `registerUserMessageHandlers` + `UserMessageContracts` |
| infra/persistence/compileDatabaseClient.test.ts | stays | Wires local `InMemoryDbClient` into factory |
| infra/persistence/KeyValueStorage/compileKeyValueStorageClient.test.ts | stays | Template compile env/config path |
| Remaining infra/* (auth, jwt, cache, events, audit, InMemoryDatabase, purge, security, exceptions, context, QueueRequestResponse) | stays | Template-owned infra, not package re-exports |
| interface/gRPC/resolveGrpcProtoPath.test.ts | stays | Template proto path resolution |
