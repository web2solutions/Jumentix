# jumentix-website (docs + marketing)

Public documentation and marketing site. Publishes curated consumer docs only — private packages are excluded by fail-closed sync.

## What it is

Public documentation and marketing site. Publishes curated consumer docs only — private packages are excluded by fail-closed sync.

## Why it exists

Juniors need a concrete app to open — not only package APIs. This hub orients you before diving into guides.

## Responsibility in context

- **Owns:** public docs IA, DocsPlayground, SEO/AI surfaces (`llms.txt`, docs-index)
- **Stack:** application (Next/Nextra)
- **Used with:** content sync from `documentation/consumers/**` and selected guides
- **Not responsible for:** hosting private tooling docs (config-*, agent-registry, etc.)


## Prerequisites

- [Getting started](/docs/jumentix/concepts/getting-started)
- Bun 1.3.14+

## Glossary

- **Reference app** — an in-monorepo application used as a teaching composition, not necessarily a SaaS you deploy as-is.

## Numbered steps

1. Open `apps/jumentix-website` in the monorepo.
2. Read its README for local run scripts.
3. Follow the linked guide for the first success path.
4. Jump to the packages that power the app (see Next step / packages hub).

## Common errors

| Symptom | Cause | Fix |
|---------|-------|-----|
| Looking for private package docs on the site | Those packages are excluded | Use public packages hub only |
| Running the wrong app folder | Mixed paths | Stay under `apps/jumentix-website` |

## Junior checklist (“I can …”)

- [ ] I can explain what this app is for in one sentence
- [ ] I know which guide to open next
- [ ] I know private tooling is not documented on this site

## Next step

[/docs/jumentix/concepts/getting-started](/docs/jumentix/concepts/getting-started)
