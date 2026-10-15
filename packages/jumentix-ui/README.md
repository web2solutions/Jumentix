# `@jumentix/jumentix-ui`

First-party UI primitives with Ext-grade contracts (Panel tools, Toolbar, Field, Button, Segmented, Tabs, List, Details, Form, Scope chrome), skinned **Jumentix dark-first**. No Sencha runtime.

## Purpose

Materialize the interaction pattern used by the Domain Designer rail and canvas toolbar so other Jumentix surfaces can reuse the same geometry and hierarchy.

## Install / consume

```css
@import '@jumentix/jumentix-ui/css';
```

Or link:

```html
<link rel="stylesheet" href="node_modules/@jumentix/jumentix-ui/src/css/jumentix-ui.css" />
```

Class prefix: `jtx-ui-*`. Tokens: `--jtx-ui-*`.

Domain Designer keeps local staging aliases `jx-*` mapped to the same geometry under `#tab-domain-designer`.

## KitchenSink

Open [`gallery/index.html`](gallery/index.html) in a browser for primitive samples.

## Natures × hierarchy (consumer guidance)

| Nature | UI job | Hierarchy touch |
| --- | --- | --- |
| Structure | Model browse/edit | Domain ⊃ Entity ⊃ Field |
| Temporal | Undo/redo | Model stack |
| Assure | Validate / diff | Read graph |
| Emit | Export | Serialize graph |
| Ingest | Import / reset | Replace graph |
| Navigate | Canvas chrome | Path read-only |

## Evidence

- `apps/service-management/docs/EXTJS-COMPONENT-REVERSE-ENGINEERING.md`
- `apps/service-management/docs/JUMENTIX-UI-FRAMEWORK-SEED.md`
