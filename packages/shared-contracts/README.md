# @jumentix/shared-contracts

Shared OpenAPI/AsyncAPI contract resolution helpers for the JumentiX SDK packages.

## Purpose

The three SDK packages (`sdk-rest-client`, `sdk-websocket-client`, `sdk-grpc-client`) each load a
canonical API document from the repository's `spec/` tree. The walk-up that finds that document was
copied into each package, and the copies drifted in exactly the way duplicated code drifts. This
package owns the single implementation:

- `loadCanonicalSpec` — parses a canonical spec from an explicit base path or by walking up from a
  module directory, failing with a descriptive error when neither exists.
- `candidateSpecPaths` — the walk-up that builds the candidate locations under `spec/`.

The SDK packages consume these helpers and stay thin typed wrappers over their own artifact
(`1.0.0.yml`, `1.0.0.websocket.yml`, `1.0.0.grpc.yml`).

The canonical checked-in contracts remain at the repository root:

- [`spec/1.0.0.yml`](../../spec/1.0.0.yml) for OpenAPI.
- [`spec/asyncapi/1.0.0.websocket.yml`](../../spec/asyncapi/1.0.0.websocket.yml) for WebSocket.
- [`spec/asyncapi/1.0.0.grpc.yml`](../../spec/asyncapi/1.0.0.grpc.yml) for gRPC.

This package owns a real source module and its own test suite (Requirement 112) and is measured for
coverage.
