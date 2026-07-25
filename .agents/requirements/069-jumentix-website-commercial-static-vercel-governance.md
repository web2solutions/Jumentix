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

## Acceptance Criteria
- Commercial pages and CTA flow exist as static routes.
- Markdown ingestion pipeline is documented and executable.
- Vercel deployment commands are available at workspace root.
- Issue-level traceability evidence exists for website epic tasks.
