# Requirement 069 - Jumentix Website Commercial Static Vercel Governance

## Requirement

The commercial website remains a Bun workspace application with versioned
content, deterministic build and test commands, and Vercel deployment
automation. Internal installation, build, test, and deployment instructions
use `bun` commands and the committed `bun.lock`.

Dependabot pull requests do not start a Vercel build of the commercial
website. `ignoreCommand` in `apps/jumentix-website/vercel.json` runs
`apps/jumentix-website/scripts/vercel-ignore-build.sh` before install.
Exit 0 skips the build. Exit 1 continues it. A merge onto `dev` or `main`
still builds, because that ref is not `dependabot/...`.

## Enforcement

- Website documentation and templates use `bun run` for repository scripts.
- The website retains its publishable content, route, Storybook, unit, and
  browser quality gates.
- Website planning and delivery evidence are maintained in Linear.
- Dependabot preview deployments are skipped. Deployments of `dev` and `main` are not.
