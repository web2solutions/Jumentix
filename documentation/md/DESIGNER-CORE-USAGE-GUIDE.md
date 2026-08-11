# @jumentix/designer-core — usage guide

`designer-core` helps frontends validate and round-trip **design documents**
without pulling Node-only dependencies. Use it in SPAs, Storybook, and docs
playgrounds.

## When to use it

- You edit domain designs in the browser.
- You need validate → export → re-import without a server.
- You want shared helpers between Service Management UI and offline PWAs.

## Install

```bash
bun add @jumentix/designer-core
```

## Try it

<DocsPlayground runtime="designer-core" id="getting-started" />

```js
const design = {
  version: 1,
  name: 'hello',
  entities: [{ name: 'Note', fields: [{ name: 'id', type: 'string' }, { name: 'text', type: 'string' }] }]
};
const result = api.validate(design);
```

## Junior checklist

1. Keep designs JSON-serializable.
2. Validate before persisting to Cana or a backend.
3. Version the document (`version` field) when you add fields.

## Errors to expect

| Problem | What to do |
| --- | --- |
| Validation fails | Read the returned issues; fix field types |
| Circular structures | Do not put class instances in the design |

## Next steps

- Persist offline with [Cana](/docs/jumentix/packages/cana/usage)
- Build a SPA: [SPA/PWA guide](/docs/jumentix/guides/spa-pwa)
- Back to [Getting started](/docs/jumentix/concepts/getting-started)
