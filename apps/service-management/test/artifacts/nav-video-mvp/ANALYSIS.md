# Nav video MVP — ANALYSIS

- Generated: 2026-10-11T12:31:30.131Z
- Branch: `cursor/feature/edge-focus-camera3-mvp`
- Shell expected: **0.9.136** (observed: 0.9.136)
- Mode: full tour
- **MVP verdict: PASS**
- Shots: **26**
- Playwright video: `tour.webm`
- MediaRecorder: `unavailable/failed` (0 bytes)
- ffmpeg frames: **68** under `frames/`

## MVP bar

1. Overview: both domains full, no ghost chips, midInside≈0
2. Domain click: Camera3 + focus domain full; other domains on stage (soft/quiet), full inventory
3. Entity click: focus entity; peers soft/quiet on stage; clickable
4. Field/rel: focus discipline; edges clean
5. Zoom fluid; Fit/Reset keep focus depth
6. Esc climbs with remount; overview restores inventory
7. Soft/quiet peers clickable (z > edges)
8. No "0 entities" ghosts; labels truthful
9. Feels like product demo

## Findings

- **[info] clean:** No automated probe failures on this tour.

## Step matrix

| # | Step | Focus | Stage | Zoom | midInside | soft | quiet | Users# | Ghosts |
| ---: | --- | --- | --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | boot | none | overview | 100% | 0 | 0 | 0 | — | — |
| 2 | load-sample | none | overview | 100% | 0 | 0 | 0 | 5 | — |
| 3 | overview | none | overview | 52% | 0 | 0 | 0 | 5 | — |
| 4 | domain-tasks | domain | focus | 43% | 0 | 6 | 0 | 5 | — |
| 5 | domain-users | domain | focus | 43% | 0 | 4 | 0 | 5 | — |
| 6 | entity-user | entity | focus | 47% | 0 | 4 | 4 | 5 | — |
| 7 | entity-task | entity | focus | 47% | 0 | 6 | 2 | 5 | — |
| 8 | entity-comment | entity | focus | 47% | 0 | 6 | 2 | 5 | — |
| 9 | field-assigneeId | field | focus | 46% | 0 | 6 | 2 | 5 | — |
| 10 | field-title | field | focus | 144% | 0 | 0 | 8 | 5 | — |
| 11 | field-projectId | field | focus | 84% | 0 | 0 | 8 | 5 | — |
| 12 | edge-select | relationship | focus | 82% | 0 | 2 | 4 | 5 | — |
| 13 | zoom-wheel-in | relationship | focus | 250% | 0 | 2 | 4 | 5 | — |
| 14 | zoom-wheel-out | relationship | focus | 35% | 0 | 2 | 4 | 5 | — |
| 15 | zoom-toolbar-in | relationship | focus | 39% | 0 | 2 | 4 | 5 | — |
| 16 | zoom-toolbar-out | relationship | focus | 35% | 0 | 2 | 4 | 5 | — |
| 17 | fit-view | relationship | focus | 82% | 0 | 2 | 4 | 5 | — |
| 18 | reset-view | relationship | focus | 82% | 0 | 2 | 4 | 5 | — |
| 19 | minimap-click | relationship | focus | 82% | 0 | 2 | 4 | 5 | — |
| 20 | esc-start-field | field | focus | 64% | 0 | 4 | 4 | 5 | — |
| 21 | esc-to-entity | entity | focus | 47% | 0 | 4 | 4 | 5 | — |
| 22 | esc-to-domain | domain | focus | 43% | 0 | 4 | 0 | 5 | — |
| 23 | esc-to-overview | none | overview | 52% | 0 | 0 | 0 | 5 | — |
| 24 | refocus-task | entity | focus | 47% | 0 | 6 | 2 | 5 | — |
| 25 | refocus-quiet-peer | entity | focus | 47% | 0 | 4 | 4 | 5 | — |
| 26 | final | entity | focus | 47% | 0 | 4 | 4 | 5 | — |

## Vision review (PNG Read)

| PNG | Verdict |
| --- | --- |
| `03-overview.png` | Both domains full (Users:5, Tasks:3). No ghost chips. |
| `04-domain-tasks.png` | Tasks focused (teal border); Users soft on stage with full inventory readable. |
| `06-entity-user.png` / `07-entity-task.png` | Entity focus + soft peer domain full inventory; quiet siblings present. |
| `23-esc-to-overview.png` | Overview restores Users:5. |
| `25-refocus-quiet-peer.png` | Peer click reaches User (focus=entity). |

### Visual bugs found earlier (fixed this pass)

1. Soft peer domains stripped to endpoint stubs (`04-domain-tasks` before: Organization-only) — **fixed** full inventory remount.
2. Soft+quiet stacked opacity looked like empty ghost chips — **fixed** soft-peer cards use soft tier.
3. Camera3 cropped soft peers off-frame on domain/entity focus — **fixed** frame unions soft-peer hulls.
4. `entity-comment` midInside=2 — **fixed** milder entity CSS scale (0.78/0.9).

### Remaining polish (not MVP blockers)

- Soft domains stay `transform:none` (edge-anchor alignment); depth is opacity/filter, not domain scale.
- Some cross-domain edges still skim card corners at overview (midInside probe=0).
- Sample toast overlays bottom-right during tour.
- WebKit headless: `captureStream` / MediaRecorder unavailable — Playwright `tour.webm` is primary.

## Fixes (file:line)

- `canvas.js` `renderDomains`: soft peers keep full hull + all entities; label `N in background`.
- `canvas.js` `syncSelectionClasses`: soft-peer-domain cards use soft tier (not quiet-on-soft).
- `canvas.js` `selectionFocusBounds`: domain/entity frame unions soft-peer domain hulls.
- `styles.css` focus depth: stronger focus chrome; milder entity scale; readable soft opacity.
- Shell pin **0.9.136** (`sw.js` / `index.html` / capture + browser tests).
- Script: `scripts/capture-nav-video-mvp.mjs`.

## Notes

- Primary capture: Playwright WebKit `recordVideo`.
- Secondary: in-page `MediaRecorder` (WebKit headless often lacks captureStream).
- Vision review of PNGs done in addition to probes.
