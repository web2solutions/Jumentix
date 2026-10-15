# Plan — Playwright massive click tour (Domain Designer)

**Issue:** JUM-918 follow-up evidence  
**Owner surface:** `apps/service-management` Domain Designer  
**Runner:** `rtk proxy bun apps/service-management/scripts/capture-massive-click-tour.mjs`  
**Artifacts:** `apps/service-management/test/artifacts/massive-click-tour/`  
**Shell expected:** whatever `sw.js` / `script.js?v=` pin at run time (currently `0.9.144`)

## Goal

One automated WebKit session that **clicks every reachable interactive control** in the Domain Designer (sample model), takes a **screenshot after each click**, and writes a **machine + human report** so visual/usability regressions are reviewable without hand-driving the UI.

This is complementary to `capture-edge-ux-evidence.mjs` (nav/selection golden + midInside). The massive tour prioritizes **coverage of chrome + tree + canvas hits**, not only edge geometry.

## Non-goals

- Full Architecture / Monitoring / OpenAPI tabs (out of Domain Designer focus).
- Destructive flows that wipe the sample mid-tour (Clear context, Delete domain) — deferred to a **destructive coda** section run last, or skipped with an explicit SKIP row.
- Multi-tab sync / offline / quota (covered by dedicated integration suites).
- Editing every form field to new values (would explode state); tour **activates** controls (click/focus) and screenshots; typed fills only where create affordances need a name to stay clickable.

## Pass criteria

| Gate | Rule |
| --- | --- |
| Completeness | Every catalogued selector either `PASS` (clicked + PNG) or `SKIP` with reason |
| Shell | `script.js?v=` and `SHELL_VERSION` match expected pin |
| Edges | After sample overview + after each domain/entity focus probe: `midInside.totalHits === 0` |
| Focus | Breadcrumb / `data-focus-kind` coherent with the clicked target when kind is domain/entity/field/relationship |
| Artifacts | `MANIFEST.json` + `TOUR.md` + numbered PNGs committed or attached as evidence |

## Catalog of click targets

### A. Boot / sample

1. Empty first-run (`#domain-designer-empty-load-sample-btn`)
2. Overview after sample settle

### B. Canvas chrome

1. `#toggle-sidebar-btn` (Panels) — open/close
2. `#quick-add-domain-btn`, `#quick-add-entity-btn`, `#quick-add-note-btn` — **SKIP** (mutating; first run created `Domain 1` and emptied the canvas under focus)
3. Canvas background click → overview
4. Minimap viewport (if present) — click once

### C. Sidebar accordion tabs

1. `data-sidebar-tab=model|history|validate|export|import`

### D. Structure / tree

1. Every `#domain-list button.domain-tree-domain`
2. Every `#domain-list .domain-tree-entity button` (expand parents first)
3. Every visible `.domain-tree-link button` (relationship browse from tree)

### E. Canvas entities / fields / edges

1. Every `.canvas .entity[data-entity-id]` header (select)
2. Every `.entity-field-row[data-field-name]` (in-page click if off-screen)
3. Every `.edge-hit[data-relationship-id]:not(.is-staged-away)` (select)
4. Edge hover then select for first N edges

### F. Domain inspector panes (when domain selected)

1. `#domain-pane-tab-identity`, `#domain-pane-tab-context`
2. Safe buttons: `#rename-domain-btn` (no-op if empty), `#set-domain-color-btn` — **SKIP** clear-context / delete

### G. Esc ladder

1. From deepest field → entity → domain → overview (screenshot each)

### H. Probes (not clicks)

1. CDP midInside snapshot after: overview, domain Tasks, entity Task, field assigneeId, relationship select, final overview

## Execution steps

1. Sync vendors (`cana`, `designer-core`, `jumentix-ui`) via `startServer` harness.
2. Hard unregister SW + reload (avoid stale shell).
3. Load sample; build live inventory via `page.evaluate` (ids present in DOM).
4. Walk catalog A→G; for each action: click → settle (~400–900ms) → screenshot `NNN-slug.png` → append MANIFEST row.
5. Write `TOUR.md` (human matrix) + `MANIFEST.json` (machine).
6. Exit non-zero if any catalogued **required** target failed or any midInside probe `totalHits > 0`.

## Output layout

```text
apps/service-management/test/artifacts/massive-click-tour/
  TOUR.md                 # human report + pass/fail matrix
  MANIFEST.json           # ordered actions, selectors, PNG paths, focus metadata
  midInside.json          # probes
  000-boot-empty.png
  001-load-sample.png
  …
```

## Risks / mitigations

| Risk | Mitigation |
| --- | --- |
| Exclusive Structure create hides Domain toolbar when domain selected | Clear selection (canvas click) only when catalog requires Domain create |
| Camera3 leaves field off-screen | `scrollIntoView` + in-page `.click()` |
| Click storms race renders | Serial clicks; settle after each; no parallel pages |
| Tour mutates model (quick-add) | Prefer activate+Esc; document any created nodes in MANIFEST |
| Flaky WebKit Abort under load | Run with `required_permissions: all` if sandbox traps; one browser context |

## Relation to existing evidence

| Pack | Purpose |
| --- | --- |
| `edge-ux-playwright/` | Golden nav/selection + midInside vs broken refs |
| `massive-click-tour/` | Exhaustive click coverage of chrome + tree + canvas |

## Done when

- Script exists and is runnable via rtk.
- One full WebKit run produced TOUR.md with zero unexplained FAIL rows.
- midInside probes all `0`.
- This plan file remains the SSOT for scope; TOUR.md is the run receipt.

## Latest run receipt (2026-10-11)

```text
rtk proxy bun apps/service-management/scripts/capture-massive-click-tour.mjs
```

| Metric | Value |
| --- | --- |
| Shots | **51** |
| PASS / SKIP / FAIL | 51 / (quick-add + destructive + any staged hits) / **0** |
| midInside | **0** on all probes |
| Shell | **0.9.144** |
| Receipt | `apps/service-management/test/artifacts/massive-click-tour/TOUR.md` |
| Manifest | `apps/service-management/test/artifacts/massive-click-tour/MANIFEST.json` |

Covered in that run: boot, sample, panels toggle, sidebar accordion (model/history/validate/export/import), tree domains Users+Tasks, tree entities (User/Organization/Email/Phone/ContactPoint/Project/Task/Comment), tree relationship links, canvas entity + field rows, edge selects (overview between), domain inspector panes, Esc ladder, final overview.
