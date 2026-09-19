# Jumentix Tooling

Repository-owned documentation automation used from root package scripts.

## Scripts

- `scripts/generate-ptbr-docs.mjs` generates governed Portuguese documentation from English source
  files and records the source marker in generated files.
- `scripts/patch-ptbr-links.mjs` rewrites links in Portuguese artifacts to their translated
  counterparts where those files exist.
- `scripts/generate-consumer-package-scripts-docs.mjs` reads the real root and workspace manifests
  and regenerates the consumer package-script reference.

## Root Commands

```bash
bun run docs:translate:ptbr
bun run docs:translate:ptbr:links
bun run docs:consumers:package-scripts
```

Generated Portuguese files must not be edited independently of their English source. Regenerate,
review the diff for terminology and link correctness, and then run the website/documentation
integrity checks.
