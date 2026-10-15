# Jumentix UI framework — seed status

**v1 landed** as `@jumentix/jumentix-ui` (`packages/jumentix-ui`).

## Intent

First-party UI primitives with Ext-grade contracts (Panel tools, Toolbar, Field, Button, Segmented, Tabs, List, Details, Form, Scope chrome), skinned with **Jumentix dark as primary**. No Sencha runtime or license surface.

## Package

- Path: `packages/jumentix-ui`
- Class prefix: `jtx-ui-*` (Domain Designer keeps staging `jx-*` under `#tab-domain-designer`)
- Entry: `@jumentix/jumentix-ui/css`
- Gallery: `packages/jumentix-ui/gallery/index.html`
- Docs: `README.md` + `README.pt-BR.md` (Requirement `117`)
- Ownership: package-local `test/` (Requirement `137`)

## Lift path (done for v1)

1. Tokens `--jtx-ui-*` from Domain Designer `--jx-*` family.
2. Primitives: button, field, toolbar, scope chrome, segmented, tabs, list, details, form.
3. Domain Designer links the package stylesheet; local CSS retains canvas geometry and domain-tree.
4. KitchenSink gallery shipped in-package.

## Evidence

- `EXTJS-COMPONENT-REVERSE-ENGINEERING.md`
- `extjs-reverse-engineer.json`
