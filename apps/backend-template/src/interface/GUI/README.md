# GUI interfaces (inbound)

This directory is the **inbound GUI slot** for the backend-template hexagonal
architecture. GUIs live on the **driving side**: they are clients that call the
application through contracts (HTTP, WebSocket, gRPC, and future local bridges).
They must not own domain rules.

## Layout

```txt
interface/GUI/
  web/       # SPA, PWA, marketing sites — React, Vue, Next, Nuxt, …
  desktop/   # Desktop shells — Electron, GTK, …
```

Both folders are **placeholders** today. Add implementations as separate
feature tasks with their own adapters, tests, and docs (EN + PT-BR).

## Hexagonal placement

| Asset | Layer |
| --- | --- |
| `GUI/web/*`, `GUI/desktop/*` | Inbound / driving (presentation clients) |
| `interface/HTTP|WebSocket|gRPC|…` | Inbound adapters that GUIs typically call |
| `modules/*/application` + `domain` | Core — never imported by GUI UI code |
| `infra/*` | Outbound — not used directly from GUI |

Call order remains:

`GUI → transport adapter/handler → controller → use case → domain → port → outbound adapter`

## Related docs

- [Architecture and Structure](../../../../../documentation/md/ARCHITECTURE-AND-STRUCTURE.md)
- Commercial map: `/architecture` on the Jumentix website
