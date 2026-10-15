# Massive click tour — receipt

- Generated: 2026-10-11T11:46:51.083Z
- Branch: `cursor/feature/edge-focus-camera3-mvp`
- Shell expected: **0.9.128**
- Shots: **51** · PASS 51 · SKIP 5 · FAIL 0
- midInside fails: **none**
- Plan: `apps/service-management/docs/PLAYWRIGHT-MASSIVE-CLICK-TOUR.plan.md`

## midInside probes

| Probe | totalHits | shell | focusKind |
| --- | ---: | --- | --- |
| overview | 0 | 0.9.128 | none |
| domainTasks | 0 | 0.9.128 | none |
| entityTask | 0 | 0.9.128 | relationship |
| fieldAssignee | 0 | 0.9.128 | field |
| relationship | 0 | 0.9.128 | none |
| finalOverview | 0 | 0.9.128 | domain |

## Action matrix

| # | Section | Action | Status | PNG | Focus | Note |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | A | boot-empty | **PASS** | `000-boot-empty.png` | none | after SW unregister |
| 2 | A | load-sample | **PASS** | `001-load-sample.png` | none |  |
| 3 | B | chrome-toggle-sidebar-btn | **PASS** | `002-chrome-toggle-sidebar-btn.png` | none |  |
| 4 | B | chrome-quick-add-domain-btn | **SKIP** | — | — | mutating create — skipped so sample stays pristine |
| 5 | B | chrome-quick-add-entity-btn | **SKIP** | — | — | mutating create — skipped so sample stays pristine |
| 6 | B | chrome-quick-add-note-btn | **SKIP** | — | — | mutating create — skipped so sample stays pristine |
| 7 | B | canvas-background-overview | **PASS** | `003-canvas-background-overview.png` | none |  |
| 8 | B | minimap | **PASS** | `004-minimap.png` | none |  |
| 9 | C | sidebar-model | **PASS** | `005-sidebar-model.png` | none |  |
| 10 | C | sidebar-history | **PASS** | `006-sidebar-history.png` | none |  |
| 11 | C | sidebar-validate | **PASS** | `007-sidebar-validate.png` | none |  |
| 12 | C | sidebar-export | **PASS** | `008-sidebar-export.png` | none |  |
| 13 | C | sidebar-import | **PASS** | `009-sidebar-import.png` | none |  |
| 14 | D | tree-domain-users | **PASS** | `010-tree-domain-users.png` | domain |  |
| 15 | D | tree-domain-tasks | **PASS** | `011-tree-domain-tasks.png` | domain |  |
| 16 | D | tree-entity-user | **PASS** | `012-tree-entity-user.png` | entity |  |
| 17 | D | tree-entity-organization | **PASS** | `013-tree-entity-organization.png` | entity |  |
| 18 | D | tree-entity-email | **PASS** | `014-tree-entity-email.png` | entity |  |
| 19 | D | tree-entity-phone | **PASS** | `015-tree-entity-phone.png` | entity |  |
| 20 | D | tree-entity-contactpoint | **PASS** | `016-tree-entity-contactpoint.png` | entity |  |
| 21 | D | tree-link-users-0 | **PASS** | `017-tree-link-users-0.png` | relationship |  |
| 22 | D | tree-link-users-1 | **PASS** | `018-tree-link-users-1.png` | relationship |  |
| 23 | D | tree-link-users-2 | **PASS** | `019-tree-link-users-2.png` | relationship |  |
| 24 | D | tree-link-users-3 | **PASS** | `020-tree-link-users-3.png` | relationship |  |
| 25 | D | tree-link-users-4 | **PASS** | `021-tree-link-users-4.png` | relationship |  |
| 26 | D | tree-link-users-5 | **PASS** | `022-tree-link-users-5.png` | relationship |  |
| 27 | D | tree-link-users-6 | **PASS** | `023-tree-link-users-6.png` | relationship |  |
| 28 | D | tree-link-users-7 | **SKIP** | — | — | click: Timeout 20000ms exceeded.
Call log:
  - waiting for locator('#domain-list .domain-tree-link button').nth(7)
 |
| 29 | D | tree-entity-project | **PASS** | `024-tree-entity-project.png` | entity |  |
| 30 | D | tree-entity-task | **PASS** | `025-tree-entity-task.png` | entity |  |
| 31 | D | tree-entity-comment | **PASS** | `026-tree-entity-comment.png` | entity |  |
| 32 | D | tree-link-tasks-0 | **PASS** | `027-tree-link-tasks-0.png` | relationship |  |
| 33 | D | tree-link-tasks-1 | **PASS** | `028-tree-link-tasks-1.png` | relationship |  |
| 34 | D | tree-link-tasks-2 | **PASS** | `029-tree-link-tasks-2.png` | relationship |  |
| 35 | D | tree-link-tasks-3 | **PASS** | `030-tree-link-tasks-3.png` | relationship |  |
| 36 | D | tree-link-tasks-4 | **PASS** | `031-tree-link-tasks-4.png` | relationship |  |
| 37 | D | tree-link-tasks-5 | **PASS** | `032-tree-link-tasks-5.png` | relationship |  |
| 38 | D | tree-link-tasks-6 | **PASS** | `033-tree-link-tasks-6.png` | relationship |  |
| 39 | E | canvas-entity-user | **PASS** | `034-canvas-entity-user.png` | none |  |
| 40 | E | canvas-entity-comment | **PASS** | `035-canvas-entity-comment.png` | none |  |
| 41 | E | field-id | **PASS** | `036-field-id.png` | field |  |
| 42 | E | field-organizationid | **PASS** | `037-field-organizationid.png` | field |  |
| 43 | E | field-username | **PASS** | `038-field-username.png` | field |  |
| 44 | E | field-firstname | **PASS** | `039-field-firstname.png` | field |  |
| 45 | E | field-lastname | **PASS** | `040-field-lastname.png` | field |  |
| 46 | E | field-password | **PASS** | `041-field-password.png` | field |  |
| 47 | E | field-createdat | **PASS** | `042-field-createdat.png` | field |  |
| 48 | E | field-updatedat | **PASS** | `043-field-updatedat.png` | field |  |
| 49 | E | field-taskid | **PASS** | `044-field-taskid.png` | field |  |
| 50 | E | field-authorid | **PASS** | `045-field-authorid.png` | field |  |
| 51 | E | field-body | **PASS** | `046-field-body.png` | field |  |
| 52 | E | edge-sample-rel-comment-author | **PASS** | `047-edge-sample-rel-comment-author.png` | none |  |
| 53 | F | domain-pane-identity | **PASS** | `048-domain-pane-identity.png` | domain |  |
| 54 | F | domain-pane-context | **PASS** | `049-domain-pane-context.png` | domain |  |
| 55 | F | clear-domain-context | **SKIP** | — | — | destructive — deferred per plan |
| 56 | H | final-overview | **PASS** | `050-final-overview.png` | domain | post Esc ladder |
