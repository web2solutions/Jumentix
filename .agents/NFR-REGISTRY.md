# Jumentix NFR Registry

This file consolidates non-functional requirements already requested and stored in `.agents/requirements`.

## Architecture and Design NFRs

- `015` DDD + Event-Driven + Hexagonal architecture baseline.
- `016` Layer call order and boundaries.
- `017` Event-first integration and circular reference avoidance.
- `036` OpenAPI port object contract requirements.
- `050` Generic adapters must become distributable packages.

## Quality, Coverage, and CI NFRs

- `011` Minimal CI gate baseline.
- `014` Codecov coverage integrity.
- `020` Coverage threshold as approval gate.
- `063` Workspace coverage policy governance.
- `065` Commit/push integrity with real CI checks.
- `087` Branch-aware quality gates: unit tests for `dev`, full matrix for `main`.
- `088` Task branches run only changed/related unit tests; `dev` PRs run all unit tests and CircleCI is restricted to `dev`/`main`.

## Security and Compliance NFRs

- `044` PCI-oriented security hardening.
- `029` Multi-tenancy and RBAC foundation.
- `067` Bidirectional task/PR traceability governance (auditability).

## Runtime and Operations NFRs

- `001` Node 22 runtime standard.
- `041` PM2 VM orchestration.
- `042` Env-driven runtime adapter selection.
- `043` Runtime env docs + governance.

## Documentation and Governance NFRs

- `018` Project docs and structure sync.
- `025` Every new feature must be documented.
- `053` Workspace package docs and ownership.
- `056`/`064` GitHub project as single source of truth.
- `057` PR grouping by priority.
- `066` Documentation round governance for marketing root + technical component docs.
- `068` NFR capture and registry governance.
- `069` Website commercial/static/vercel governance.
- `070` npm organization and vercel scope integration governance.
- `071` Spec Development Driven governance baseline.
- `072` Spec Development Driven canonical knowledge coverage.
- `073` Engineering practices (git, commit messages, lint, coding best practices) represented in specs.
- `074` Security and compliance practices represented in specs.
- `075` Jumentix composition (libraries, tools, templates, components) represented in specs.
- `076` Mandatory task traceability for AI/humans + documentation sync + EN/PT documentation and website parity.
- `077` Multi-agent platform support (Codex, Claude Code, Grok) with aligned governance and traceability rules.
- `078` Agent Registry system with mandatory pre-task registration, planning assignment by availability, and required `main`/`dev` pre-work branch checks.
- `079` Main branch protection and mandatory feature/fix/chore branching flow; local direct changes on `main` are prohibited.
- `080` Agent Registry must include machine identity and agent runtime version metadata, allowing multiple agents per host machine.
- `081` Agent playbook must teach registration, branch sync checks, governance execution, and closure/audit workflow.
- `082` PR descriptions must use real breaklines/markdown formatting; literal `\n` tokens are prohibited.
- `083` Feature and bug branches must be deleted (local + remote) after merge into `dev`, unless explicitly justified.
- `084` `dev` is the single source of truth for development; new branches must start from `dev` and PRs from implementation branches must target `dev`.
- `085` PR descriptions are mandatory and must follow the repository PR template, with required sections completed before approval.
- `086` One task per branch and PR, nature-prefixed naming, `dev`-first promotion to `main`, and mandatory false-green-proof full test matrices for commits, pushes, and PRs.
- `089` Agent Registry must be maintained in an independent GitHub repository as canonical source, with mirrored sync in consumer repositories.
- `090` Every executable task must have one focused epic, one primary nature, and the epic milestone; milestone validation precedes epic-level agent delegation and non-overlapping child-task assignment.
- `091` Website design-system and Storybook governance, including accessibility, responsive/theme states, component inventory, reproducible smoke validation, and strict ownership by the `apps/jumentix-website` workflow rather than the main monorepo workflow.
- `092` Open-source commercial website experience, bilingual route parity, truthful code proof, responsive navigation, and production route integrity.
- `093` Consumer documentation information architecture, bilingual route parity, source synchronization, navigation depth, and publication integrity.
- `094` Every Linear Project used as an epic must have a dedicated documentation Issue completed before the Project can be completed.

## Rule of Use

When a new NFR is requested:

1. add/update requirement file in `.agents/requirements/`
2. update `.agents/README.md` index
3. update this registry mapping
