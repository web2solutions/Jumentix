# @jumentix/key-value-storage

Reusable key-value storage adapters for Jumentix services.

Included:

- `IKeyValueStorageClient` contracts
- `InMemoryKeyValueStorageClient`
- `RedisKeyValueStorageClient`
- `compileKeyValueStorageClient` environment-driven selector

This package is designed for multi-service reuse and avoids per-service adapter duplication.

## Try it in the browser

In-memory adapter (browser mock of the same contract):

<DocsPlayground runtime="key-value-storage" id="getting-started" />

## Full documentation

See the consumer [usage guide](../../documentation/md/KEY-VALUE-STORAGE-USAGE-GUIDE.md).
