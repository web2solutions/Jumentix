# JUM-918 Edge UX Playwright Evidence Pack

- Generated: 2026-10-12T18:11:02.149Z
- Branch: `cursor/feature/edge-focus-camera3-mvp`
- Command: `rtk proxy bun apps/service-management/scripts/capture-edge-ux-evidence.mjs`
- Shell: **0.9.144** (soft-refresh hard Reload if stale)
- Reference broken shots: `/Users/eduardoalmeida/.cursor/projects/Users-eduardoalmeida-apps-Jumentix/assets/Screenshot_2026-10-11_*.png` (64 files)
- Failures: **1** / 11

## midInside CDP

| Probe | totalHits | ghostVerticals | labelsOnCards | stagedGhosts | shell |
| --- | ---: | ---: | ---: | ---: | --- |
| overview | 0 | 0 | 0 | 0 | 0.9.144 |
| domainTasks | 0 | 0 | 0 | 0 | 0.9.144 |
| domainUsers | 0 | 0 | 0 | 0 | 0.9.144 |
| domainUsersExclusive | undefined | 0 | undefined | undefined | undefined |
| entityProject | 0 | 0 | 0 | 0 | 0.9.144 |
| entityTask | 0 | 0 | 0 | 0 | 0.9.144 |
| fieldAssignee | 0 | 0 | 0 | 0 | 0.9.144 |
| fieldProjectId | 0 | 0 | 0 | 0 | 0.9.144 |
| fieldTaskId | 0 | 0 | 0 | 0 | 0.9.144 |
| relTaskProject | 1 | 0 | 0 | 0 | 0.9.144 |
| relAssignee | 0 | 0 | 0 | 0 | 0.9.144 |
| afterEscOverview | 0 | 0 | 0 | 0 | 0.9.144 |
| camera3Field | 0 | 0 | 0 | 0 | 0.9.144 |
| finalOverview | 0 | 0 | 0 | 0 | 0.9.144 |

## Comparison matrix (broken refs → after)

| Scene | What was broken (user refs) | After screenshot | midInside | ghostVerticals | focus match | Verdict |
| --- | --- | --- | ---: | ---: | --- | --- |
| Sample overview (Users+Tasks) | Floating vertical gutters between domains; lines through cards; parallel bars | `01-sample-overview.png` | 0 | 0 | n/a (overview) | **PASS** |
| Domain Tasks focus (vs Screenshot_2026-10-11_at_7.34.08_AM) | Users empty 0-entities chip + vertical corridor of parallel white lines + floating labels | `02-domain-tasks.png` | 0 | 0 | true | **PASS** |
| Domain Users exclusive (tree Browse click) | Both domains equal weight; Camera3 never flies; Tasks not soft/quiet | `03-domain-users.png` | 0 | n/a | true | **PASS** |
| Entity Project | Wrong stage peers; lines through Project/Task text | `04-entity-project.png` | 0 | n/a | true | **PASS** |
| Entity Task | Project centered while Task selected | `05-entity-task.png` | 0 | n/a | true | **PASS** |
| Field assigneeId | Breadcrumb Field…assigneeId but Project centered; empty inspector | `09-field-assigneeId.png / 22-camera3-field-assignee.png` | 0 | n/a | true | **PASS** |
| Field projectId | Label projectId→id on Task chrome | `10-field-projectId.png` | 0 | n/a | true | **PASS** |
| Relationship Project↔Task | Corridor through cards; oversized handles | `13-rel-select-task-project.png` | 1 | 0 | true | **FAIL** |
| Relationship Task→User (assignee) | Cross-domain floating vertical corridor | `14-rel-select-task-assignee.png` | 0 | 0 | n/a | **PASS** |
| Esc ladder field→entity→domain→overview | Focus mismatch / stuck stage | `16…19-esc-*.png` | 0 | n/a | true | **PASS** |
| Final overview soft-refresh shell | Stale SW showing old ghost routes | `24-final-overview.png` | 0 | n/a | n/a | **PASS** |

## Screenshot index

- `00-boot-empty.png` — empty first-run after hard reload (scope: Nothing selected)
- `01-sample-overview.png` — sample loaded overview (scope: Domain · Users)
- `02-domain-tasks.png` — domain Tasks + Users soft peers (vs 7.34.08AM) (scope: Domain · Tasks)
- `03-domain-users.png` — domain Users exclusive + Tasks soft (scope: Domain · Users)
- `04-entity-project.png` — entity Project (scope: Tasks · Project)
- `05-entity-task.png` — entity Task (scope: Tasks · Task)
- `06-entity-comment.png` — entity Comment (scope: Tasks · Comment)
- `07-entity-user.png` — entity User (scope: Users · User)
- `08-entity-organization.png` — entity Organization (scope: Users · Organization)
- `09-field-assigneeId.png` — field Task.assigneeId (scope: Field · Tasks → Task → assigneeId)
- `10-field-projectId.png` — field Task.projectId (scope: Field · Tasks → Task → projectId)
- `11-field-taskId.png` — field Comment.taskId (scope: Field · Tasks → Comment → taskId)
- `12-rel-hover-task-project.png` — hover Project↔Task (scope: Tasks · Task)
- `13-rel-select-task-project.png` — select Project↔Task (scope: Relationship)
- `14-rel-select-task-assignee.png` — select Task→User assignee (scope: 2 domains)
- `15-rel-select-comment-task.png` — select Comment→Task (scope: Relationship)
- `16-esc-start-field.png` — before Esc ladder (scope: Field · Tasks → Task → assigneeId)
- `17-esc-to-entity.png` — Esc → entity (scope: Tasks · Task)
- `18-esc-to-domain.png` — Esc → domain (scope: Domain · Tasks)
- `19-esc-to-overview.png` — Esc → overview (scope: 2 domains)
- `20-camera3-entity-project.png` — Camera3 settle on Project (scope: Tasks · Project)
- `21-camera3-relationship.png` — Camera3 settle on relationship (scope: Relationship)
- `22-camera3-field-assignee.png` — Camera3 settle on field (scope: Field · Tasks → Task → assigneeId)
- `23-structure-create-domain.png` — structure create domain toolbar (scope: 2 domains)
- `24-final-overview.png` — final overview (scope: 2 domains)

## Soft-refresh note

If the live browser still shows ghost gutters, hard Reload so SW `0.9.144` + `script.js?v=0.9.144` load. Stale shells keep the pre-fix router.

## WebGL

Deferred — CSS transform + scroll Camera3 path; no WebGL scaffolding.
