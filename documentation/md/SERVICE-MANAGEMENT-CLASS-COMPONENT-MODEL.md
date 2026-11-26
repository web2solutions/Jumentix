# Service Management Class-Component Model

Vanilla ES class UI for `apps/service-management`. No React/Vue. Each tab is a
`TabApplication`; shared chrome lives under `Component`. Domain logic stays in
`@jumentix/designer-core`.

## Why

The shell grew as `create*` factories wired from `script.js`. That pattern does
not scale: tabs share opaque closures, child surfaces have no ownership, and
new UI keeps landing in the monolith. The class model gives every tab and
child a named owner, an explicit mount/destroy cycle, and a folder per tab.

## Core types

| Class | Path | Role |
| --- | --- | --- |
| `Component` | `src/ui/component/Component.js` | Base: `el`, children, `on`/`mount`/`destroy`/`render` |
| `TabApplication` | `src/ui/component/TabApplication.js` | Tab app: `key`, `activate`/`deactivate`, `ctx` |
| `TabHost` | `src/ui/app/TabHost.js` | Tablist chrome, hash sync, ARIA keyboard |
| `ServiceManagementApp` | `src/ui/app/ServiceManagementApp.js` | Shell host; registers every tab |
| `LegacyTabApplication` | `src/ui/app/LegacyTabApplication.js` | Adapter until a tab is fully peeled |

## Folder layout

```
src/ui/component/          # Component, TabApplication
src/ui/app/                # ServiceManagementApp, TabHost, LegacyTabApplication
src/ui/tabs/<tab-key>/     # One TabApplication + its children per tab
src/ui/shared/             # Cross-tab only (future home for ControlHelp, …)
```

## Rules

1. New SM UI is a `class extends Component|TabApplication` under `src/ui/…`.
2. Do not add new `create*` factories in the shell. Legacy factories are an
   allow-list until their tab PR removes them.
3. A tab must not import children of another tab. Share only via `src/ui/shared/`
   or designer-core.
4. UI classes do not reimplement model/validation — call designer-core.

## Migration status

| Tab | Class | Status |
| --- | --- | --- |
| Architecture | `ArchitectureTab` + EmptyState/Coach children | Peeled (canvas controller still a factory behind the tab) |
| Domain Designer | `DomainDesignerTab` | Stub → Legacy hooks; peel next |
| Interface Designer | `InterfaceDesignerTab` | Stub |
| Service Config | `ServiceConfigTab` | Stub |
| Deploy Management | `DeployManagementTab` | Stub |
| Monitoring | `MonitoringTab` | Stub |
| OpenAPI | `OpenApiTab` | Stub (prefer next after Architecture) |
| Code Workspace | `CodeWorkspaceTab` | Stub |

Suggested peel order after Architecture: OpenAPI → Monitoring → inspectors-split
tabs (Interface / Service Config / Deploy) → Domain Designer → Code Workspace.

## Shell layout (canvas-first)

- **Main nav** is a left icon rail inside `aside.main-nav` (no top header). The
  hamburger expands/collapses **labels only** — all eight apps stay clickable.
- **Stage** fills remaining viewport width at `100dvh`.
- Architecture / Domain Designer keep a **canvas floor** (`--jx-canvas-min`) and
  an elastic right rail (`--jx-rail-width`). The rail starts **contracted**
  (hamburger-style Panels toggle); Hide/Show expands or contracts it. Below
  ~1100px stage width an open rail auto-closes (or overlays) so the canvas stays
  evident. Manual Show reopens it.

## Boot

`script.js` constructs `ServiceManagementApp`, registers the eight tab classes,
calls `smApp.mount()`, and keeps a thin `tabs` facade (`setActiveTab` /
`renderTabs` / `applyHashTab`) for remaining call sites.

## Tests

- `test/unit/component.dom.test.ts` — Component / TabApplication lifecycle
- `test/unit/serviceManagementApp.dom.test.ts` — TabHost + ArchitectureTab mount
- `test/unit/architectureCanvas.dom.test.ts` — canvas controller behaviour
