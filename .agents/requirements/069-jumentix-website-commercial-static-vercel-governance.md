# Requirement 069 - Jumentix Website Commercial + Static + Vercel Governance

## Context
- Jumentix requires a commercial website to support enterprise lead conversion.
- Website must be static-first and sourced from repository markdown content.
- Deployment must be executable through package scripts and Vercel integration.

## Mandatory Rules
1. Website application lives in `apps/jumentix-website`.
2. Website narrative is commercial/product-oriented, separate from engineering README concerns.
3. Static content generation must support repository markdown as source-of-truth inputs.
4. Website deployment must be runnable from root `package.json` commands targeting Vercel.
5. Website work items must be tracked in GitHub Project Jumentix with governance fields and issue traceability updates.
6. Public documentation routes must render inside the complete documentation layout, including
   global navigation, search, sidebar, table of contents, feedback, edit links, and footer.
7. Canonical documentation routes use `/docs/jumentix/<slug>`; maintained legacy `/docs/<slug>`
   routes must remain functional until an explicit migration removes them.
8. Content synchronization must never replace valid generated documentation with missing-source
   placeholders. It must preserve a valid generated artifact or fail.
9. Repository-relative documentation links must resolve to a published website route or a valid
   repository URL.
10. Website install, build, test, and deployment automation must use pnpm and the workspace
    lockfile.

## Acceptance Criteria
- Commercial pages and CTA flow exist as static routes.
- Markdown ingestion pipeline is documented and executable.
- Canonical and legacy documentation routes are covered by the prepublish gate.
- Generated content is deterministic in monorepo and isolated Vercel app-root builds.
- Vercel deployment commands are available at workspace root.
- Issue-level traceability evidence exists for website epic tasks.
