# Nav video MVP — ANALYSIS

- Generated: 2026-10-12T02:45:12.675Z
- Branch: `cursor/feature/edge-focus-camera3-mvp`
- Shell expected: **0.9.143** (observed: 0.9.143)
- Mode: full tour
- **MVP verdict: PASS**
- Shots: **26**
- Playwright video: `tour.webm`
- MediaRecorder: `unavailable/failed` (0 bytes)
- ffmpeg frames: **69** under `frames/`

## MVP bar

1. Overview: both domains full, no ghost chips, midInside≈0
2. Domain click: Camera3 + focus domain full; other domains on stage (soft/quiet), full inventory
3. Entity click: focus entity alone (unique is-focus); peers soft/quiet on stage; clickable
4. Field/rel: focus discipline; edges clean; soft peers never is-focus
5. Zoom fluid; Fit/Reset keep focus depth; camera centers on primary subject
6. Esc climbs with remount; overview restores inventory
7. Soft/quiet peers clickable (z > edges), recessed vs exclusive focus ring
8. No "0 entities" ghosts; labels truthful
9. Feels like product demo
10. Unique focus: exactly one `.is-focus` (domain OR entity; nested entity ⇒ domain is context-active only)

## Findings

- **[info] clean:** No automated probe failures on this tour.

## Step matrix

| # | Step | Focus | Stage | Zoom | midInside | soft | quiet | Users# | Ghosts |
| ---: | --- | --- | --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | boot | none | overview | 100% | 0 | 0 | 0 | — | — |
| 2 | load-sample | none | overview | 100% | 0 | 0 | 0 | 5 | — |
| 3 | overview | none | overview | 52% | 0 | 0 | 0 | 5 | — |
| 4 | domain-tasks | domain | focus | 52% | 0 | 6 | 0 | 5 | — |
| 5 | domain-users | domain | focus | 52% | 0 | 4 | 0 | 5 | — |
| 6 | entity-user | entity | focus | 148% | 0 | 4 | 4 | 5 | — |
| 7 | entity-task | entity | focus | 156% | 0 | 6 | 2 | 5 | — |
| 8 | entity-comment | entity | focus | 156% | 0 | 6 | 2 | 5 | — |
| 9 | field-assigneeId | field | focus | 165% | 0 | 6 | 2 | 5 | — |
| 10 | field-title | field | focus | 165% | 0 | 0 | 8 | 5 | — |
| 11 | field-projectId | field | focus | 165% | 0 | 0 | 8 | 5 | — |
| 12 | edge-select | relationship | focus | 139% | 0 | 8 | 0 | 5 | — |
| 13 | zoom-wheel-in | entity | focus | 250% | 0 | 6 | 2 | 5 | — |
| 14 | zoom-wheel-out | entity | focus | 35% | 0 | 6 | 2 | 5 | — |
| 15 | zoom-toolbar-in | entity | focus | 39% | 0 | 6 | 2 | 5 | — |
| 16 | zoom-toolbar-out | entity | focus | 35% | 0 | 6 | 2 | 5 | — |
| 17 | fit-view | entity | focus | 156% | 0 | 6 | 2 | 5 | — |
| 18 | reset-view | entity | focus | 156% | 0 | 6 | 2 | 5 | — |
| 19 | minimap-click | entity | focus | 156% | 0 | 6 | 2 | 5 | — |
| 20 | esc-start-field | field | focus | 165% | 0 | 6 | 2 | 5 | — |
| 21 | esc-to-entity | entity | focus | 175% | 0 | 6 | 2 | 5 | — |
| 22 | esc-to-domain | domain | focus | 73% | 0 | 6 | 0 | 5 | — |
| 23 | esc-to-overview | none | overview | 52% | 0 | 0 | 0 | 5 | — |
| 24 | refocus-task | entity | focus | 156% | 0 | 6 | 2 | 5 | — |
| 25 | refocus-quiet-peer | entity | focus | 166% | 0 | 4 | 4 | 5 | — |
| 26 | final | entity | focus | 166% | 0 | 4 | 4 | 5 | — |

## Notes

- Primary capture: Playwright WebKit `recordVideo`.
- Secondary: in-page `MediaRecorder` (WebKit headless often lacks captureStream).
- Vision review of PNGs required in addition to probes.
