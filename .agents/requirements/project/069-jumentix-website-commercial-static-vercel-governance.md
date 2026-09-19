# Requirement 069 - Jumentix Website Commercial Static Vercel Governance

## Requirement

The commercial website remains a Bun workspace application with versioned
content, deterministic build and test commands, and Vercel deployment
automation. Internal installation, build, test, and deployment instructions
use `bun` commands and the committed `bun.lock`.

## Enforcement

- Website documentation and templates use `bun run` for repository scripts.
- The website retains its publishable content, route, Storybook, unit, and
  browser quality gates.
- Website planning and delivery evidence are maintained in Linear.
