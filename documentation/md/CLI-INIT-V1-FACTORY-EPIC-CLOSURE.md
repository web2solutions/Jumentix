# cli-init v1 Factory Epic — Closure Record (Req 094)

This is the epic documentation / closure record for the Linear Project
**[EPIC][CLI] @jumentix/cli-init v1: factory generator (init/add/upgrade/doctor)**
([JUM-856](https://linear.app/jumentix/issue/JUM-856/governance-epic-record-and-closure-req-094-umbrella)).
It is the terminal governance evidence under
[Requirement 094](../../.agents/requirements/project/094-epic-documentation-completion-gate.md).

It names the full issue chain and records PR and merge-commit evidence for
every C1–C14 delivery on `dev`. Product behaviour of the factory CLI is owned by
[Factory Generator CLI (`@jumentix/cli-init`)](./BOOTSTRAP-CLI-SCAFFOLDING.md)
and the
[Service Factory Capabilities Matrix](./JUMENTIX-SERVICE-FACTORY-CAPABILITIES-MATRIX.md);
this document records and links — it does not restate command semantics.

English reference. Portuguese:
[CLI-INIT-V1-FACTORY-EPIC-CLOSURE.pt-BR.md](./CLI-INIT-V1-FACTORY-EPIC-CLOSURE.pt-BR.md).

## Epic identity

| Field | Value |
| --- | --- |
| Epic name | `[EPIC][CLI] @jumentix/cli-init v1: factory generator (init/add/upgrade/doctor)` |
| Linear Project | https://linear.app/jumentix/project/epiccli-jumentixcli-init-v1-factory-generator-initaddupgradedoctor-298d8d918e17 |
| Milestone | `cli-init v1 published — 2026-12-19` (target 2026-12-19) |
| Closure Issue | [JUM-856](https://linear.app/jumentix/issue/JUM-856/governance-epic-record-and-closure-req-094-umbrella) |
| Dedicated docs Issue (Req 094 gate) | [JUM-855](https://linear.app/jumentix/issue/JUM-855/docs-cli-v1-documentation-bootstrap-doc-rewrite-website-getting) |

**Gate state, exactly.** Under Req 094 the Linear Project **must not** be set
to `Completed` until this documentation / closure Issue (**JUM-856**) is
`Done`, and the dedicated product-documentation Issue (**JUM-855**) must also
be `Done` before project completion. Issue comments and status alone are not
enough: Project Updates (Req 102) must carry start, material progress,
review-ready, and final handoff with exact gate states — never describe a
pending, missing, cancelled, timed-out, skipped, or failed required check as
passing.

## Published chain (C1–C14 / JUM-843…856)

The epic order is C1 → C14. C11 (publishing) may run in parallel with C4/C5
after C2; C12 starts with C5; C13 is the dedicated documentation Issue; C14
is this closure record and closes last.

| Link | Issue | Role | Document / surface |
| --- | --- | --- | --- |
| C1 | [JUM-843](https://linear.app/jumentix/issue/JUM-843/governance-requirement-037-v2-factory-generator-rules-and-epic-record) | Governance — Req 037 v2 factory generator rules | `.agents/requirements/software/037-bootstrap-cli-scaffolding.md`, ledger / NFR rows |
| C2 | [JUM-844](https://linear.app/jumentix/issue/JUM-844/refactor-cli-core-command-router-prompt-engine-config-file-typescript) | Refactor — CLI core (router, prompts, config, TypeScript build) | `packages/cli-init` |
| C3 | [JUM-845](https://linear.app/jumentix/issue/JUM-845/feature-template-packaging-seeds-bundled-in-the-cli-with-a-freshness) | Feature — template packaging + freshness gate | `packages/cli-init` templates / `check-template-freshness` |
| C4 | [JUM-846](https://linear.app/jumentix/issue/JUM-846/feature-source-resolution-designer-export-oas-catalog-url-or-users) | Feature — source resolution → `GenerationPlan` | `packages/cli-init` |
| C5 | [JUM-847](https://linear.app/jumentix/issue/JUM-847/feature-backend-generation-core-service-and-domain-services-sliced) | Feature — backend generation | `packages/cli-init` |
| C6 | [JUM-848](https://linear.app/jumentix/issue/JUM-848/feature-frontend-generation-frontend-seed-slice-with-one-module-per) | Feature — frontend generation | `packages/cli-init` |
| C7 | [JUM-849](https://linear.app/jumentix/issue/JUM-849/feature-workspace-assembly-root-manifest-docker-git-readme-projectjson) | Feature — workspace assembly | `packages/cli-init` |
| C8 | [JUM-850](https://linear.app/jumentix/issue/JUM-850/feature-add-domain-add-service-add-frontend-on-a-generated-project) | Feature — `add domain\|service\|frontend` | `packages/cli-init` |
| C9 | [JUM-851](https://linear.app/jumentix/issue/JUM-851/feature-upgrade-template-three-way-merge-with-report) | Feature — `upgrade` three-way merge | `packages/cli-init` |
| C10 | [JUM-852](https://linear.app/jumentix/issue/JUM-852/feature-doctor-environment-and-project-diagnostics) | Feature — `doctor` diagnostics | `packages/cli-init` |
| C11 | [JUM-853](https://linear.app/jumentix/issue/JUM-853/feature-publishing-jumentix-packages-and-the-cli-on-npm-under-release) | Feature — npm publishability under release governance | `@jumentix/*` packages + CLI |
| C12 | [JUM-854](https://linear.app/jumentix/issue/JUM-854/test-generation-e2e-matrix-in-docker-and-cli-unit-suites) | Test — generation e2e matrix + CLI suites | `packages/cli-init` tests / Docker matrix |
| C13 | [JUM-855](https://linear.app/jumentix/issue/JUM-855/docs-cli-v1-documentation-bootstrap-doc-rewrite-website-getting) | Docs — bootstrap rewrite, getting-started, factory matrix (Req 094 gate) | [BOOTSTRAP-CLI-SCAFFOLDING.md](./BOOTSTRAP-CLI-SCAFFOLDING.md), website getting-started, matrix |
| C14 | [JUM-856](https://linear.app/jumentix/issue/JUM-856/governance-epic-record-and-closure-req-094-umbrella) | Governance — epic record and closure (this document) | this document (+ pt-BR) |

## Traceability: PR URL + merge commit SHA

All C1–C14 delivery PRs have merged to `dev`. SHAs below are the GitHub
merge commits for those PRs (command: `gh api repos/web2solutions/Jumentix/pulls/<n> --jq .merge_commit_sha`).

| Link | Issue | PR URL | Merge commit SHA |
| --- | --- | --- | --- |
| C1 | JUM-843 | https://github.com/web2solutions/Jumentix/pull/371 | `1c84117f5dd9a39aa18e745fd7a81c5a6963a8f3` |
| C2 | JUM-844 | https://github.com/web2solutions/Jumentix/pull/373 | `9e1137a63a5e76feb7fd2a58124384d539217f34` |
| C3 | JUM-845 | https://github.com/web2solutions/Jumentix/pull/377 | `518645c302f434dbf94789180c24421231b7c893` |
| C4 | JUM-846 | https://github.com/web2solutions/Jumentix/pull/384 | `cdc0c846b76e8843de7eee5555a031d8b99be8f1` |
| C5 | JUM-847 | https://github.com/web2solutions/Jumentix/pull/386 | `5987d41574cdcb944bb4581f7627bb2ed11f3e49` |
| C6 | JUM-848 | https://github.com/web2solutions/Jumentix/pull/387 | `9e37ad64bd034e4b710c197d22be62f0ef007d8e` |
| C7 | JUM-849 | https://github.com/web2solutions/Jumentix/pull/388 | `0d236b8f8079d514889c8ac9bd3ce61ad01bfbed` |
| C8 | JUM-850 | https://github.com/web2solutions/Jumentix/pull/389 | `1aa69de89420893b10a138e87610ce2bb034c287` |
| C9 | JUM-851 | https://github.com/web2solutions/Jumentix/pull/390 | `78bc4a8f92cf50052b3b727cb8bae8e1ab552133` |
| C10 | JUM-852 | https://github.com/web2solutions/Jumentix/pull/391 | `40bb147de7aa43b11eb5d8af2b690b81c29610fc` |
| C11 | JUM-853 | https://github.com/web2solutions/Jumentix/pull/379 | `d4d4f19c6124c3ad0d8b7eef16fc6914112630f0` |
| C12 | JUM-854 | https://github.com/web2solutions/Jumentix/pull/392 | `3e87a876b01e7bd0f963ea1f5aac00b92569c031` |
| C13 | JUM-855 | https://github.com/web2solutions/Jumentix/pull/394 | `a963054cd641652ee85330fde7309ff398256a79` |
| C14 | JUM-856 | https://github.com/web2solutions/Jumentix/pull/395 | `aa590173d47d2153a6a93e672cbaad7db9e1ffb5` |

**Publishability vs live npm (Req 130).** JUM-853 made packages publishable and
passed `bun run npm:packages:check` / `bun run release:dry-run:packages`. Live
`0.1.0-rc.1` publish and `npm view` were **not** executed: `NPM_TOKEN` was
missing in the delivery environment. Do not treat registry presence as done.

## Related governed sources

- [Factory Generator CLI](./BOOTSTRAP-CLI-SCAFFOLDING.md) (+ pt-BR)
- [Service Factory Capabilities Matrix](./JUMENTIX-SERVICE-FACTORY-CAPABILITIES-MATRIX.md) (+ pt-BR)
- [Spec Development Driven Index](./SPEC-DEVELOPMENT-DRIVEN-INDEX.md)
- [Spec Requirements Traceability Ledger](./SPEC-REQUIREMENTS-TRACEABILITY-LEDGER.md)
- Requirement `037` (v2), Requirement `094`, Requirement `102`

## What this document deliberately does not cover

- Command flags, generated layout, and doctor exit codes — owned by
  [BOOTSTRAP-CLI-SCAFFOLDING.md](./BOOTSTRAP-CLI-SCAFFOLDING.md).
- Factory mode matrix rows — owned by
  [JUMENTIX-SERVICE-FACTORY-CAPABILITIES-MATRIX.md](./JUMENTIX-SERVICE-FACTORY-CAPABILITIES-MATRIX.md).
- Implementation detail inside `packages/cli-init` — owned by the package
  and the delivery Issues above.
