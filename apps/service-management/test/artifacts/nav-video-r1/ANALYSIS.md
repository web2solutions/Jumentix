# Nav video Round 1 — ANALYSIS

- Recorded: 2026-10-11 (shell **0.9.136** at capture)
- Shell after fixes: **0.9.137**
- Video: `apps/service-management/test/artifacts/nav-video-r1/tour.webm`
- Verdict (probes): **PASS** (midInside=0 throughout; soft peers full inventory)

## Findings this round (vision + probes)

1. **Toast covers canvas chrome** — Sample-loaded toast sat bottom-right over mini-map / canvas edge (`03-overview`, `04-domain-tasks`).
2. **Soft peer depth too mild** — Users domain at opacity ~0.82 still competed with Tasks focus; soft edges stayed near-opaque white (`04`, `07`).
3. **Soft domains cannot CSS-scale** — `transform:none` required for edge anchors; depth needed another cue (veil / filter).
4. **Quiet siblings soft** — Same-domain quiet entities still fairly bright vs focus card (`06`, `07`).
5. **Domain focus framing equal-weight** — Camera union treated focus + soft peers equally; soft peers on-frame but focus felt less centered (`04`, `22`).
6. **Zoom-in void** — Deep wheel zoom on relationship left large empty canvas (`13`) — residual for later (user zoom, not framing bug).
7. **Transition settle** — Depth tier opacity/filter lacked matching entity settle transitions.

## Fixes applied (→ shell 0.9.137)

| Area | Change |
| --- | --- |
| Toast | Designer-active `.status-region` offset clear of mini-map (right/bottom calc) |
| Soft domain depth | Opacity 0.68, stronger desat, `::after` depth veil (no transform) |
| Focus chrome | Stronger accent ring + glow on focus domain/entity |
| Quiet / soft entities | Quieter opacity (0.42 / 0.78); settle transitions 320ms |
| Soft edges | Opacity 0.58 so background corridors don't compete |
| Camera | Domain-focus frame biased 18% toward home hull |
| Labels | Soft/quiet `.entity-count` italic muted |

## Residual for Round 2

- Soft-domain *visual scale* still absent (anchors forbid domain transform) — explore layout/CSS creative options further.
- Field focus can still crop soft-peer domain hulls (`09`/`10` framing).
- Deep user zoom emptiness / re-center polish.
- Peer click hit-testing under veil / edge layer — verify after stronger dimming.
- Overview ContactPoint hull clipping (layout, not focus).

## Key PNGs reviewed

`03-overview`, `04-domain-tasks`, `06-entity-user`, `07-entity-task`, `09-field-assigneeId`, `13-zoom-wheel-in`, `22-esc-to-domain`, `25-refocus-quiet-peer`
