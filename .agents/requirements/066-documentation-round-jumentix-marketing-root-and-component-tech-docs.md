# Requirement 066 - Documentation Round: Marketing Root + Component Technical Docs

## Context
- Jumentix monorepo requires split documentation ownership:
  - root documentation is product/marketing oriented
  - component documentation is technical and implementation oriented
- Navigation must remain centralized through root README index.
- GitHub Project Jumentix is the canonical source of truth for documentation tasks.

## Mandatory Rules
1. Root `README.md` must keep badges and include product purpose, audience, value proposition, and advantages.
2. Root `README.md` must contain index links to every major component documentation hub.
3. Component docs must live under each component folder (`apps/*`, `packages/*`, `tooling/*` when applicable).
4. Mandatory solution sections must exist and be linked from root docs:
   - SPA/PWA
   - REST API
   - Realtime API
   - SaaS monolith
   - SaaS microservices
5. Documentation work must be tracked as GitHub issues under the documentation epic and added to GitHub Project Jumentix.

## Acceptance Criteria
- Root README index has no broken links to component hubs and mandatory guides.
- Component technical hubs exist and include actionable technical navigation.
- Epic and child tasks are present in GitHub Project Jumentix with labels/priorities.
