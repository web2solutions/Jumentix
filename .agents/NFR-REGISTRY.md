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
- `056`/`064` ~~GitHub project as single source of truth~~ (superseded by `095`).
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
- `077` Multi-agent platform support (Codex, Claude Code, Grok, OpenCode) with aligned governance and traceability rules.
- `078` Agent Registry system with mandatory pre-task registration, planning assignment by availability, and required `main`/`dev` pre-work branch checks.
- `079` Main branch protection and mandatory feature/fix/chore branching flow; local direct
  changes on `main` are prohibited, review is optional, and all required checks remain mandatory.
- `080` Agent Registry must include machine identity and agent runtime version metadata, allowing multiple agents per host machine.
- `081` Agent playbook must teach registration, branch sync checks, governance execution, and closure/audit workflow.
- `082` PR descriptions must use real breaklines/markdown formatting; literal `\n` tokens are prohibited.
- `083` Feature and bug branches must be deleted (local + remote) after merge into `dev`, unless explicitly justified.
- `084` `dev` is the single source of truth for development; new branches must start from `dev` and PRs from implementation branches must target `dev`.
- `085` PR descriptions are mandatory and must follow the repository PR template, with required sections completed before approval.
- `086` One task per branch and PR, matching `[JUM-XXXX][Nature]` PR-title naming, `dev`-first promotion to `main`, and
  false-green-proof destination-aware gates for task branches, `dev`, and `main`.
- `089` Agent Registry must be maintained in an independent public GitHub repository as canonical source, with mirrored sync in consumer repositories, immutable revision pins by full commit SHA, and owner-only write access for `web2solutions` (`web2solucoes@gmail.com`).
- `090` Every executable task must have one focused epic, one primary nature, and the epic milestone; milestone validation precedes epic-level agent delegation and non-overlapping child-task assignment.
- `091` Website design-system and Storybook governance, including accessibility, responsive/theme states, component inventory, reproducible smoke validation, and strict ownership by the `apps/jumentix-website` workflow rather than the main monorepo workflow.
- `092` Open-source commercial website experience, bilingual route parity, truthful code proof, responsive navigation, and production route integrity.
- `093` Consumer documentation information architecture, bilingual route parity, source synchronization, navigation depth, and publication integrity.
- `094` Every Linear Project used as an epic must have a dedicated documentation Issue completed before the Project can be completed.
- `095` Linear as single source of truth with API key security rules.
- `096` A pinned Bun toolchain becomes the sole internal engineering runtime, package manager, script runner and test platform, with phased supersession of `001`, `012` and `048` for internal tooling at Bun cutover; Node remains only as declared consumer-facing compatibility.
- `097` Linear task and Project metadata lifecycle: agents must maintain valid status, priority, dates, labels, ownership, milestone alignment, and auditable Project Updates from acceptance through completion.
- `098` Commit, push, and merge authorization is restricted to the project owner and explicitly
  authorized identities; platform protection requires checks but not PR approval.

## Rule of Use

- `099` Every task begins only after current `main`, `dev`, and the full requirement inventory are refreshed and read.
- `100` Every valid pull-request comment blocks merge until it is corrected with applicable gate
  evidence; an invalid comment requires a factual explanation in the PR.
- `101` Agents waiting only on remote checks must progress another active, non-conflicting task
  in its own worktree and recheck the waiting task at material boundaries.
- `102` Every executing task must publish truthful, task-specific Linear Project Updates at
  start, material progress, blocker/risk changes, review readiness, and final handoff.
- `103` The private `XpertMinds` application and agent-registry repositories are canonical;
  both former `web2solutions` origins are deprecated, read-only, accept no new modifications,
  and remain archived after their final migration delivery.
- `104` Every applicable application integration from the deprecated origin must be
  inventoried and rebound to `XpertMinds/Jumentix`, with fail-closed provider credentials,
  terminal canonical evidence, and incomplete provider installs recorded as explicit owner-auth
  blockers; `integration-migration:check` and `integrations:check` validate the repository-owned
  contract.
- `105` CircleCI is the sole CI provider; GitHub Actions is retired and no workflow file
  may act as a required check. The pipeline must run on every branch, not only `dev` and
  `main`, and a provider that cannot execute blocks a merge exactly as a failing check
  does (Requirement 065). `ci:check-provider` validates the migration is complete.
- `106` An HTTP adapter named for a web framework must import that framework and use it;
  a reference assigned to an unused field, or a require swallowed by try/catch, does not
  satisfy this, and the framework must be a declared dependency. Platform targets with no
  framework are exempt by explicit listing. `arch:check-http-adapters` validates it.
- `107` A test suite must be able to tell a real implementation from a fake one: every
  adapter carries at least one assertion only the real dependency can satisfy, integration
  coverage of adapter directories is 100%, and a missing dependency fails its suite rather
  than skipping it. Asserting correct behaviour is not enough when a substitute produces
  identical behaviour — the AdonisJS adapter passed every test while integrating nothing.

When a new NFR is requested:

1. add/update requirement file in `.agents/requirements/`
2. update `.agents/README.md` index
3. update this registry mapping
