# Nav video Round 3 — ANALYSIS

- Recorded: 2026-10-11 (shell **0.9.138** at capture — R2 fixes live)
- Shell after fixes: **0.9.139**
- Video: `apps/service-management/test/artifacts/nav-video-r3/tour.webm`
- Verdict (probes): **PASS** (midInside=0; soft peers full inventory)

## Findings this round (vision on R2 residuals)

1. **Toast cleared** — Sample toast now bottom-left; mini-map unobstructed (`03`). R2 fix verified.
2. **Soft depth balanced** — Users soft peer readable + clearly behind Tasks focus (`04`, `07`). Good.
3. **Field framing improved** — `10-field-title` keeps quiet siblings (Comment) + home hull; no longer Task-only crop.
4. **Relationship focus crops soft peers** — `12-edge-select` showed Tasks-only; Users quiet/collapsed (probe users=0). Need one-hop soft peers + hull framing.
5. **Deep wheel zoom still voids** — `13-zoom-wheel-in` still parks on fragments / empty corridor.
6. **Soft-domain scale** — Still no transform; R3 adds inset outline faux-recede.

## Fixes applied (→ shell 0.9.139)

| Area | Change |
| --- | --- |
| Relationship scenario | One-hop incident endpoints + same-domain siblings; soft peer domains stay on stage |
| Relationship camera | Union soft-peer hulls; bias toward corridor mid |
| Deep zoom | Focus-stage zoom-in blends pointer anchor toward selection center |
| Soft domain depth | `outline-offset: -10px` inset silhouette (scale-free) |
| Quiet entities | Opacity 0.48 (readable siblings, still behind focus) |

## Residual (post R3 — future polish)

- True soft-domain CSS scale still blocked by model-space edge anchors.
- Overview ContactPoint hull clipping / packing.
- Edge skim at soft domain borders under curved routing.
- MediaRecorder/captureStream unavailable in WebKit headless (Playwright `tour.webm` remains primary).

## Key PNGs reviewed

`03-overview`, `04-domain-tasks`, `07-entity-task`, `09-field-assigneeId`, `10-field-title`, `12-edge-select`, `13-zoom-wheel-in`, `22-esc-to-domain`
