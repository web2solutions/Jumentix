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
- `020` Coverage threshold as approval gate.
- `063` Workspace coverage policy governance.
- `065` Commit/push integrity with real CI checks.
- `087` Branch-aware quality gates: unit tests for `dev`, full matrix for `main`.
- `088` Task branches run changed/related tests with branch-aware gates; `dev` PRs and
  release promotion run their destination-appropriate required checks.

## Security and Compliance NFRs

- `044` PCI-oriented security hardening.
- `029` Multi-tenancy and RBAC foundation.
- `067` Bidirectional task/PR traceability governance (auditability).

## Runtime and Operations NFRs

- `041` PM2 VM orchestration.
- `042` Env-driven runtime adapter selection.
- `043` Runtime env docs + governance.
- `126` Service Management ownership registration and pinned public contracts
  (`/api/runtime/env`, `service-management.v1` storage schema, export formats),
  so component drift and re-homing breaks fail checks instead of serving silent
  defaults.
- `127` Mandatory `rtk` and Caveman usage in every agent session
- Soft-delete tombstones (`deletedAt`) are the default delete path for User/Organization; uniqueness is released on tombstone; ids stay reserved. Physical purge is opt-in (JUM-822): 90-day floor, dev PM2 dry-run by default, `--commit` required to drop PII, id ledger never reused.
- Entity metrics (`GET /{entities}/metrics`) are bounded by `x-metrics-capabilities` and exclude tombstones (JUM-793).
- `128` Requirement changes take precedence in the release process (sequence only, no gate exemption)
- `129` Mandatory Firebase RTDB agent progress bus (`agent-bus:publish|watch|status`)
- `130` Measured claims and bounded work: no unmeasured numbers, no proxy stated as cause
- `131` Built artifacts must carry every runtime export their source barrel declares
- `132` No orphaned published artifacts: reachable, or declared with the issue that owns it
- `133` Declared indexes for ordered queries: `.indexOn` in versioned rules, or order by key
- `134` No flaky tests: a suite establishes what it depends on, never sleeps to synchronise
- `135` No fake tests: assert the effect, declare the assertions, never target a percentage
- `136` Frontend knows the backend only through its OAS: spec document or generated SDKs, never backend source

## Documentation and Governance NFRs

- `018` Project docs and structure sync.
- `025` Every new feature must be documented.
- `053` Workspace package docs and ownership.
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
- `078` Agent Registry system (Firestore-backed) with mandatory pre-task registration, planning assignment by availability, and required `main`/`dev` pre-work branch checks.
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
- `089` Agent Registry must be maintained in Firestore Database as canonical source, with optional local snapshot for offline consultation, service-account-only write access, and stale-snapshot validation in CI gates.
- `090` Every executable task must have one focused epic, one primary nature, and the epic milestone; milestone validation precedes epic-level agent delegation and non-overlapping child-task assignment.
- `091` Website design-system and Storybook governance, including accessibility, responsive/theme states, component inventory, reproducible smoke validation, and strict ownership by the `apps/jumentix-website` workflow rather than the main monorepo workflow.
- `092` Open-source commercial website experience, bilingual route parity, truthful code proof, responsive navigation, and production route integrity.
- `093` Consumer documentation information architecture, bilingual route parity, source synchronization, navigation depth, and publication integrity.
- `094` Every Linear Project used as an epic must have a dedicated documentation Issue completed before the Project can be completed.
- `095` Linear as single source of truth with API key security rules.
- `096` Bun `1.3.13` is the pinned internal package manager and command interface; Node 22 is allowed only at declared compatibility and tool boundaries.
- `097` Linear task and Project metadata lifecycle: agents must maintain valid status, priority, dates, labels, ownership, milestone alignment, and auditable Project Updates from acceptance through completion.
- `098` Commit, push, and merge authorization is restricted to the project owner and explicitly
  authorized identities; platform protection requires checks but not PR approval.

## Rule of Use

- `099` Every task begins only after current `main`, `dev`, and the full requirement inventory are refreshed and read.
- `100` Every valid pull-request comment and every unresolved GitHub review/discussion
  thread blocks merge until it is corrected, resolved, or answered as invalid with
  factual PR evidence and applicable gate evidence.
- `101` Agents waiting only on remote checks must progress another active, non-conflicting task
  in its own worktree and recheck the waiting task at material boundaries.
- `102` Every executing task must publish truthful, task-specific Linear Project Updates at
  start, material progress, blocker/risk changes, review readiness, and final handoff.
- `104` Every applicable application integration from the deprecated origin must be
  inventoried and rebound to `XpertMinds/Jumentix`, with fail-closed provider credentials,
  terminal canonical evidence, and incomplete provider installs recorded as explicit owner-auth
  blockers; `integration-migration:check` and `integrations:check` validate the repository-owned
  contract.
- `105` Hexagonal Test Pyramid: `test-map.json` layer ownership, alias-aware blast-radius
  selection, `JUMENTIX_GATE_V2` flag-gated flip/rollback, and fail-closed selective-gate evidence.
- `106` Local Bun for **all** suite types; Node/Jest reserved for CI (`ciRunner` /
  `JUMENTIX_TEST_RUNTIME=node`). CI job greenness is out of scope for the Test Pyramid delivery.
- `108` An HTTP adapter named for a web framework must import that framework and use it;
  a reference assigned to an unused field, or a require swallowed by try/catch, does not
  satisfy this, and the framework must be a declared dependency. Platform targets with no
  framework are exempt by explicit listing. `arch:check-http-adapters` validates it.
- `109` A test suite must be able to tell a real implementation from a fake one: every
  adapter carries at least one assertion only the real dependency can satisfy, integration
  coverage of adapter directories is 100%, and a missing dependency fails its suite rather
  than skipping it. Asserting correct behaviour is not enough when a substitute produces
  identical behaviour — the AdonisJS adapter passed every test while integrating nothing.
- `110` `bun:test` is the test runner; Jest is retained solely as the coverage
  instrument, because Bun emits no branch records at all and Requirements 020/063 mandate
  90% branch coverage. `ci-cd/check-coverage-thresholds.js` is the
  authority on all four metrics, reading Istanbul's report rather than lcov (which has no
  statement counter) and failing closed on any it cannot measure. A metric may sit below its
  threshold only under a dated, issue-tracked exception that ratchets: below its floor fails,
  and reaching the threshold while the entry remains also fails, so a concession expires
  instead of becoming a lowered bar. The thresholds apply over the measured scope, and
  narrowing the scope is not a permitted way to meet one. A suite may
  declare `runner: "node"` only with a `reason` naming a concrete Bun incompatibility;
  the map pin overrides environment resolution. Amends 106.
- `111` Only identities declared in `.agents/AUTHORIZED-COMMITTERS.json` may author,
  commit, or push. The declaration is an allowlist and must not be inverted into a denylist: the audit
  behind this requirement started from one known corporate address and uncovered a second
  corporate domain nobody was looking for, which a denylist would have passed. Author and
  committer are both checked, since they diverge on rebases, amends and web merges.
  `governance:check-authorship` verifies existing commits from a declared history cutoff —
  anchored to a fixed commit, because a base-relative range is empty, and therefore vacuously
  green, on the branch the work merged into. `--identity` verifies the identity a commit is
  about to receive, in `pre-commit`, because the range check cannot see a commit that does
  not exist yet and commit metadata cannot be retracted once pushed. `pre-push` runs the
  same history check before publication, so undeclared local commits cannot reach the forge.
  Every commit must also carry a GitHub-verified signature before it can merge into a
  protected branch. No identity is set globally on a contributor machine. Fails closed on a missing, empty or
  unparseable declaration (Requirement 065).

- `112` Every workspace package and app owns a test suite covering its own source, at
  the project's 99% standard. Coverage borrowed from a consumer measures the consumer: a
  library exercised only by an application's tests is not tested, and the break surfaces
  three layers up where the reader starts at the wrong end. Packages do not depend on one
  another's suites in the development workflow — a commit runs the affected suites, and the
  full matrix is the release gate for `main`, not a per-commit tax. A package that runs in a
  browser is verified in a real browser, headless, through Cypress, with no shims and no fake
  libraries; `packages/cana` currently runs on `fake-indexeddb` and owes that replacement.
  Debt is declared in `WITHOUT_SUITE_YET` with a date, an issue and a reason, and the register
  ratchets: a declared package that has since grown a suite fails too, so the list cannot
  become a permanent exemption. The same list is the Sonar coverage exclusion set, and the two
  disagreeing in either direction fails. `packages:check-suites` validates it.
- `113` Public open-source CI uses GitHub Actions as the canonical orchestrator and
  CircleCI as a secondary mirror. Task delivery to `dev` uses cheap layer-aware gates;
  release promotion to `main` runs full
  coverage, Codecov publishing, Sonar defense-in-depth, website, integration,
  workspace and database checks.
- `114` Agent onboard uses an operator-confirmed filesystem root (this host:
  `/Users/eduardoalmeida/apps/XpertMinds`) and the layout
  `<root>/<agent-identifier>/Jumentix` as the only SoT checkout for that agent.
- `115` Tests are mandatory, functional, and Jumentix-valued: no vacuous/fake suites
  and no suites whose primary subject is a third-party implementation API.
- `116` Before every task, re-read the full `.agents/requirements/project/` and
  `.agents/requirements/software/` set and NFR registry on both `origin/dev` and
  `origin/main`, record drift, and avoid rework (strengthens `099`).
- `117` Every new feature updates software documentation and adds dedicated feature
  docs (EN/PT) in the same delivery (strengthens `025` / `076`).
- `118` Smoke and integration suites use Docker to start real dependent services and
  exercise their declared surface; silent skips are not green (strengthens `046` / `047`).
- `119` Orchestration with Linear, GitHub, and other external services must prefer
  APIs (or official CLIs that wrap those APIs) over browser/app UI automation;
  GitHub must always use `gh` (strengthens `081` / `095`).
- `120` Linear must identify the active `agent_identifier` for every executable
  task and expose delegated agent ownership for each Project/Epic, synchronized
  with the canonical Agent Registry.
- `121` Registered agents must work as a coordinated delivery system by refreshing
  sibling-agent progress, blockers, branches, PRs, and Linear Project Updates before
  starting or resuming work, avoiding silent overlap or duplicate delivery.
- `129` Agents must publish and consume the Firebase RTDB agent progress bus for
  machine-readable peer sync; Firestore remains ownership SSOT (`089` / `121`).
- `122` Task-owned branch and PR naming governance (migrated from duplicate `079`).
- `124` Monorepo root layout governance (migrated from duplicate `060`).
- `125` Supported agents are declared as data in `.agents/supported-agents.json`; the PR
  governance gate derives task-branch prefixes from the declaration, verifies each declared
  agent's instructions file exists, and fails closed on a missing or malformed declaration.

When a new NFR is requested:

1. add/update requirement file in `.agents/requirements/project/` or `.agents/requirements/software/`
2. update `.agents/README.md` index
3. update this registry mapping
